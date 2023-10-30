// load accessToken from the access-token file using d3 using async/await
async function getAccessToken() {
    const response = await d3.text("access-token");
    return response;
}
// Set the access token
mapboxgl.accessToken = await getAccessToken();

// Initialize the map
var map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v10",
    center: [-71.104081, 42.365554],
    zoom: 12,
});

// Disable default box zooming for box-select
map.boxZoom.disable();

// Load the data and plot the points
d3.csv("boston-airbnb-listings.csv", d3.autoType).then(function (data) {
    console.log(data);
    data.forEach(function (d) {
        d.price_log_num = Math.log(Number(d.price.replace(/[$,]/g, ""))); // convert price to number
    });

    // Get the minimum and maximum rating values from the data
    var minRating = d3.min(data, function (d) {
        return d.review_scores_rating;
    });
    var maxRating = d3.max(data, function (d) {
        return d.review_scores_rating;
    });
    var minPrice = d3.min(data, function (d) {
        return d.price_log_num;
    });
    var maxPrice = d3.max(data, function (d) {
        return d.price_log_num;
    });

    // Add a new source to the map
    // The source is named "listings" and its type is "geojson".
    map.addSource("listings", {
        type: "geojson",
        data: {
            //  The data for the source is a FeatureCollection, which is created by mapping over the data array and creating a new Feature object for each item in the array. Each Feature object has a Point geometry with coordinates specified by the longitude and latitude properties of the data item. 
            type: "FeatureCollection",
            features: data.map(function (d) {
                return {
                    //The Feature object also has a properties object with several properties including listing_url, name, price, price_log_num, and rating. These properties are used to create the heatmap layer and the circle layer that is added to the map in the code below
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [d.longitude, d.latitude],
                    },
                    properties: {
                        listing_url: d.listing_url,
                        name: d.name,
                        price: d.price,
                        price_log_num: d.price_log_num,
                        rating: d.review_scores_rating,
                    },
                };
            }),
        },
    });

    // Add a heatmap layer to the map
    map.addLayer({
        id: "listings-heatmap",
        type: "heatmap",
        source: "listings",
        maxzoom: 15,
        paint: {
            // Increase the heatmap weight based on frequency and property magnitude
            "heatmap-weight": {
                property: "rating",
                type: "exponential",
                stops: [
                    [0, 0],
                    [maxRating, 1],
                ],
            },
            // Increase the heatmap color weight weight by zoom level
            // heatmap-intensity is a multiplier on top of heatmap-weight
            "heatmap-intensity": {
                stops: [
                    [0, 1],
                    [15, 3],
                ],
            },
            // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
            // Begin color ramp at 0-stop with a 0-transparency color
            // to create a blur-like effect.
            "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(33,102,172,0)",
                0.2,
                "rgb(103,169,207)",
                0.4,
                "rgb(209,229,240)",
                0.6,
                "rgb(253,219,199)",
                0.8,
                "rgb(239,138,98)",
                1,
                "rgb(178,24,43)",
            ],
            // Adjust the heatmap radius by zoom level
            "heatmap-radius": {
                stops: [
                    [0, 2],
                    [15, 20],
                ],
            },
            // Transition from heatmap to circle layer by zoom level
            "heatmap-opacity": {
                default: 1,
                stops: [
                    [14, 1],
                    [15, 0],
                ],
            },
        },
    });

    // Add a new layer to the map
    map.addLayer({
        // The layer is defined with an ID of "listings-circles" and a type of "circle". The source of the layer is set to "listings".
        id: "listings-circles",
        type: "circle",
        source: "listings",
        // The paint property is used to define the visual appearance of the circles. 
        paint: {
            //The circle-radius property is set using a stops array that maps the "rating" property of each circle to a specific radius value. The minRating and maxRating variables are used to define the range of possible rating values.
            "circle-radius": {
                property: "rating",
                stops: [
                    [minRating, 2],
                    [maxRating, 10],
                ],
            },
            // The circle-color property is set using an "interpolate" expression that maps the "price_log_num" property of each circle to a specific color value. The minPrice and maxPrice variables are used to define the range of possible price values. The color values are defined using hexadecimal color codes.

            "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "price_log_num"],
                minPrice,
                "#fff7ec",
                maxPrice,
                "#7f0000",
            ],
            // Finally, the circle-opacity property is set to 0.8 to define the opacity of the circles.  
            "circle-opacity": 0.8,
        },
    });

    // Add a new layer to the map
    // This layer is used to highlight the selected circles by showing boundaries around them. See drag-to-select section below.
    map.addLayer({
        id: "listings-circles-highlighted",
        type: "circle",
        source: "listings",
        paint: {
            "circle-radius": {
                property: "rating",
                stops: [
                    [minRating, 2],
                    [maxRating, 10],
                ],
            },
            "circle-color": "rgba(255, 255, 255, 0)", // transparent white
            "circle-stroke-color": "#7f0000",
            "circle-stroke-width": 1,
            "circle-opacity": 0.8
        },
        "filter": ["in", "listing_url", ""] // initially, filter out all circles
    });



    // ***** Add tooltip to the circles (start) *****//
    let tooltip;
    map.on("mouseenter", "listings-circles", function (e) {
        var features = map.queryRenderedFeatures(e.point, {
            layers: ["listings-circles"],
        });

        if (!features.length) {
            return;
        }

        var feature = features[0];

        tooltip = new mapboxgl.Popup({
            offset: [0, -15],
        })
            .setLngLat(feature.geometry.coordinates)
            .setHTML(
                "<h3>" +
                feature.properties.name +
                "</h3><p>Price: $" +
                feature.properties.price +
                "</p><p>Rating: " +
                feature.properties.rating +
                "</p>"
            )
            .addTo(map);
    });

    // Remove tooltip when mouse leaves the circle
    map.on("mouseleave", "listings-circles", function () {
        map.getCanvas().style.cursor = "";
        tooltip.remove();
    });
    // ***** Add tooltip to the circles (end) *****//

    map.addControl(new mapboxgl.NavigationControl()); // Add zoom and rotation controls to the map.

    map.setLayoutProperty("listings-heatmap", "visibility", "none");
    map.setLayoutProperty("listings-circles", "visibility", "visible");
    map.setLayoutProperty("listings-circles-highlighted", "visibility", "visible");

    //******************* drag to select (start) ****************/
    // reference: https://docs.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/
    const canvas = map.getCanvasContainer();

    // Set `true` to dispatch the event before other functions
    // call it. This is necessary for disabling the default map
    // dragging behaviour.
    canvas.addEventListener('mousedown', mouseDown, true);

    // Return the xy coordinates of the mouse position
    function mousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return new mapboxgl.Point(
            e.clientX - rect.left - canvas.clientLeft,
            e.clientY - rect.top - canvas.clientTop
        );
    }
    let start, current, box;
    function mouseDown(e) {
        // Continue the rest of the function if the shiftkey is pressed.
        if (!(e.shiftKey && e.button === 0)) return;

        // Disable default drag zooming when the shift key is held down.
        map.dragPan.disable();

        // Call functions for the following events
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);

        // Capture the first xy coordinates
        start = mousePos(e);
    }

    function onMouseMove(e) {
        // Capture the ongoing xy coordinates
        current = mousePos(e);

        // Append the box element if it doesnt exist
        if (!box) {
            box = document.createElement('div');
            box.classList.add('boxdraw');
            canvas.appendChild(box);
        }

        const minX = Math.min(start.x, current.x),
            maxX = Math.max(start.x, current.x),
            minY = Math.min(start.y, current.y),
            maxY = Math.max(start.y, current.y);

        // Adjust width and xy position of the box element ongoing
        const pos = `translate(${minX}px, ${minY}px)`;
        box.style.transform = pos;
        box.style.width = maxX - minX + 'px';
        box.style.height = maxY - minY + 'px';
    }

    function onMouseUp(e) {
        // Capture xy coordinates
        finish([start, mousePos(e)]);
    }

    function onKeyDown(e) {
        // If the ESC key is pressed
        if (e.keyCode === 27) finish();
    }

    function finish(bbox) {
        // Remove these events now that finish has been called.
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('mouseup', onMouseUp);

        if (box) {
            box.parentNode.removeChild(box);
            box = null;
        }

        // If bbox exists. use this value as the argument for `queryRenderedFeatures`
        if (bbox) {
            const features = map.queryRenderedFeatures(bbox, {
                layers: ['listings-circles']
            });

            if (features.length >= 1000) {
                return window.alert('Select a smaller number of features');
            }

            let selectedCircles = [];
            features.forEach(function (feature) {
                selectedCircles.push(feature.properties.listing_url);
            });

            map.setFilter(
                "listings-circles-highlighted", ["in", "listing_url"].concat(selectedCircles)
            );
        }

        map.dragPan.enable();
    }
    //******************* drag to select (end) ****************/
});

// Define a variable to keep track of the current layer
let currentLayer = "listings-circles";

// Add a toggle button to switch between the heatmap and the circles
const toggleButton = document.querySelector("#button");
// toggleButton.textContent = "Toggle Layer";
toggleButton.addEventListener("click", function () {
    if (currentLayer === "listings-heatmap") {
        map.setLayoutProperty("listings-heatmap", "visibility", "none");
        map.setLayoutProperty("listings-circles", "visibility", "visible");
        map.setLayoutProperty("listings-circles-highlighted", "visibility", "visible");
        currentLayer = "listings-circles";
    } else {
        map.setLayoutProperty("listings-heatmap", "visibility", "visible");
        map.setLayoutProperty("listings-circles", "visibility", "none");
        map.setLayoutProperty("listings-circles-highlighted", "visibility", "none");
        currentLayer = "listings-heatmap";
    }
});
