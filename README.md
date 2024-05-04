![Motion Comparator](./public/teaser.jpg)

<div align="center">
    <h1>Motion Projector</h1>
    <!-- <a href= "TODO"><img alt="status: online" src="https://img.shields.io/badge/status-online-success.svg?logoHeight=10"></a>
    <a href= "TODO"><img alt="demo: ready" src="https://img.shields.io/badge/demo-ready-success.svg?logoHeight=10"></a>
    <a href= "TODO"><img alt="docs: ready" src="https://img.shields.io/badge/version-v0.80.0 Beta-blue.svg?logoHeight=10"></a> -->
  
</div>

Motion Projector is an web-based application to visualize robot joint motions. 

## Installation
<!-- We recommend using the [hosted version of Motion Comparator](TODO).  -->

If you would like to play around with the code, the dependencies of Motion Comparator can be isntalled by:
```
npm install
npm start
```
Then you need to manually start the server locally. Please locate file "src/scripts/UMAPserver.py" and 
then run that python file before using the UMAP features.

## Contributing

Motion Projector is written in [TypeScript](https://www.typescriptlang.org/) using [React](https://react.dev/) and [rc-dock](https://github.com/ticlo/rc-dock) – contributions are welcome! The program is built on [Motion Comparator]() and the UMAP graph is implemented using [React-Plotly](https://github.com/plotly/react-plotly.js).

## Credits
Motion Projector draws a lot of design inspiration from robot visualization tools, especially [Foxglove Studio](https://github.com/foxglove/studio) and [Webviz](https://github.com/cruise-automation/webviz). The teaser image is generated by AI using NightCafe Studio.

<!-- ## TODO
[ ] Import ROS bags
[ ] Update to the latest version of three.js -->
