![Motion Comparator](./public/teaser.jpg)

<div align="center">
    <h1>Motion Projector</h1>
    <!-- <a href= "TODO"><img alt="status: online" src="https://img.shields.io/badge/status-online-success.svg?logoHeight=10"></a>
    <a href= "TODO"><img alt="demo: ready" src="https://img.shields.io/badge/demo-ready-success.svg?logoHeight=10"></a>
    <a href= "TODO"><img alt="docs: ready" src="https://img.shields.io/badge/version-v0.80.0 Beta-blue.svg?logoHeight=10"></a> -->
  
</div>

Motion Projector is an web-based application to visualize robot motions. The high dimension robot data in joint space is reduced to 2D tracjectories which are displayed on a graph. Our tool provides interactive and diagonatic tools to evaluate the performance of the dimensionality reduction and help users understand the robot motions.

## Development/Deployment

*Note:* the code currently cannot be built on Linux. That being said, it can be built on Mac and Windows, and the deployed website can be veiwed from any updated browser).

For development/deployment of the code:

 - Clone the repo to your local machine

 - cd into the RobotJointMotionReduction folder

 - run `git submodule init` to initialize the git submodules that the app uses for a couple of dependencies

 - run `git submodule update` to update the git submodules

 - run `npm install` to install all npm dependencies

 - `npm start` to develop the app localy

### Warning

 - running `npm update` to update all npm dependencies will break the application and make you unable to build it

## File Overview

Here are the files added/modified to create UMAP graphs. The rest of the files are identical to the files in [Motion Comparator](https://github.com/uwgraphics/MotionComparator). Please refer to [Motion Comparator](https://github.com/uwgraphics/MotionComparator) for more details.

 - `src/scripts/UMAPserver.py` is the local "backend" server that calculates the UMAP/Parametric UMAP embeddings as well as the $n$-neighbors of each point.
 - `src/scripts/object3D/UmapGraph.tsx` constains all parameters of a umap graph panel. For exmaple, it has nneighbors, displayGaps, and so on. If you want to add more parameters such as a distance threshold, you can add it in this class.
 - `src/scripts/object3D/UmapPoint.tsx` contains all information about a point on umap. The most important information is the distances to its neighbors. Note that the id of the UmapPoint is number not string. This is becuase there may be a lot of points on umap and strings can take up a lot of space.
 - `src/scripts/react_components/UmapLineGraph.tsx` uses [React-Plotly](https://github.com/plotly/react-plotly.js) to create a graph to display the reduced data. You can customize the layout of the graph by changing plotly_layout variable. You can also customize the behaviors of the graph. Currently, the customized behaviors are as follows:
   - `onPlotlyHover`: when the users hover on a point, set the global time to be the timestamp of that point.
   - `onPlotlyClick`: when the users click on a point, show its $n$-neighbors on the graph and display corresponding robot poses in 3D.
   - `onPlotlyLegendClick`: This is single-click on an item in the legend. It show/hide a trace. For gaps/stretches/folds, it also opens/closes a robot scene that displays the corresponding robot poses.
   - `onPlotlyLegendDoubleClick`: This is double-click on an item in the legend. It removes (not hides!!!) a trace from the graph and triggers the recalculation of the embeddings. 
 - `src/scripts/react_components/panels/UmapGraphPanel.tsx` is a panel that contains a `UmapLineGraph`. It preprocesses and sends data to the server. Then it passes the data to `UmapLineGraph` to display them.
 - `src/scripts/react_components/panels/UmapGraphOptionPanel.tsx` is a panel that enables users to change the parameters and settings of the umap graph. For exmaple, users can choose to display the gaps here.
 - `src/scripts/scene/StaticRobotScene.tsx` contains a scene where one or more robot poses are displayed. Note that this is different from RobotScene as the robots here do not move. They are "static".
 - `src/scripts/react_components/RobotWorkspace.tsx`: some functions are added to this file to open/close the pop-up panel that displays the `StaticRobotScene`. 
 - `src/scripts/RobotSceneManager.tsx`: this file is updated so that the `RobotSceneManager` knows all active `StaticRobotScene` and `UmapGraph`.

## branch overview
 - `main` branch contains the latest version of the tool.
 - `figure` branch: the background color is changed to white to create better figures for the paper.

Please create new branches instead of working directly on the `main` branch.

## Contributing

Motion Projector is written in [TypeScript](https://www.typescriptlang.org/) using [React](https://react.dev/) and [rc-dock](https://github.com/ticlo/rc-dock) – contributions are welcome! The program is built on [Motion Comparator](https://github.com/uwgraphics/MotionComparator) and the UMAP graph is implemented using [React-Plotly](https://github.com/plotly/react-plotly.js).

## Credits
Motion Projector draws a lot of design inspiration from robot visualization tools, especially [Foxglove Studio](https://github.com/foxglove/studio) and [Webviz](https://github.com/cruise-automation/webviz). The teaser image is generated by AI using NightCafe Studio.

<!-- ## TODO
[ ] Import ROS bags
[ ] Update to the latest version of three.js -->
