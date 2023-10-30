# Mapbox Template
This repository contains a template for creating a map using Mapbox. The code is written in JavaScript and uses the Mapbox GL JS library.

Demo: https://www.namwkim.org/mapbox-template/
## Getting Started
To get started, you will need to obtain an access token from Mapbox. You can do this by creating an account on the Mapbox website and following the instructions to create a new access token.

Once you have your access token, you will need to set `mapboxgl.accessToken` in `main.js` using your own access token.

## Running the Code
To run the code, download VSCode and install the Live Server extension to open the index.html file in a web browser. Alternatively, you can simply run a Python web server in the root folder.

## Code Overview
The code is divided into several sections:

* Loading the access token
* Initializing the map
* Loading data and plotting points
* Adding a heatmap layer to the map
* Adding a circle layer to the map
* Adding a tooltip
* Addding an interative drag selection