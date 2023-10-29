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
    map.addSource("listings", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: data.map(function (d) {
                return {
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
        id: "listings-circles",
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
            "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "price_log_num"],
                minPrice,
                "#fff7ec",
                maxPrice,
                "#7f0000",
            ],
            "circle-opacity": 0.8,
        },
    });
    
    // Add a new layer to the map
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



    // Add tooltip to the circles
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

    map.setLayoutProperty("listings-heatmap", "visibility", "none");
    map.setLayoutProperty("listings-circles", "visibility", "visible");
    map.setLayoutProperty("listings-circles-highlighted", "visibility", "visible");

    // Initialize the draw control
    // reference: https://github.com/charliedotau/mapbox-gl-js-select-features-by-draw/blob/master/index.html
    // reference: https://docs.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/
    var draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true,
        },
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(draw);

    // When a new circle is drawn, filter the listings-circles layer to show only the selected circles
    map.on("draw.create", select);
    map.on("draw.update",select );
    function select(e) {
        
        // Convert the features to a bounding box
        var userPolygon = e.features[0];

        // generate bounding box from polygon the user drew
        var polygonBoundingBox = turf.bbox(userPolygon);

        var southWest = [polygonBoundingBox[0], polygonBoundingBox[1]];
        var northEast = [polygonBoundingBox[2], polygonBoundingBox[3]];

        var northEastPointPixel = map.project(northEast);
        var southWestPointPixel = map.project(southWest);

        var selectedCircles = [];

        var features = map.queryRenderedFeatures(
            [southWestPointPixel, northEastPointPixel],
            {
                layers: ["listings-circles"],
            }
        );
        
        var selectedCircles = features.reduce(function (memo, feature) {
            // console.log(JSON.parse(JSON.stringify(feature)), userPolygon)
            if (!(undefined === turf.inside(feature, userPolygon))) {
                // only add the property, if the feature intersects with the polygon drawn by the user

                memo.push(feature.properties.listing_url);
            }

            return memo;
        },[]);
        console.log(selectedCircles.length);
        console.log(["in", "listing_url"].concat(selectedCircles))
        // features.forEach(function (feature) {
        //     selectedCircles.push(feature.properties.name);
        // });
        
        map.setFilter(
            "listings-circles-highlighted",["in", "listing_url"].concat(selectedCircles)
        );
        map.dragPan.disable();
    }
    // When a circle is removed, reset the filter to show all circles
    map.on("draw.delete", function () {
        map.setFilter("listings-circles-highlighted", ["in", "listing_url", ""]);
    });

    // When the draw mode is exited, reset the filter to show all circles
    map.on("draw.modechange", function () {
        map.setFilter("listings-circles-highlighted", ["in", "listing_url", ""]);
    });

    // Mute out unselected circles
    map.setPaintProperty("listings-circles", "circle-opacity", [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        0.7,
        0.2,
    ]);
});

// Define a variable to keep track of the current layer
let currentLayer = "listings-circles";

// Add a toggle button to switch between the heatmap and the circles
const toggleButton = document.querySelector("#button");
toggleButton.textContent = "Toggle Layer";
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
