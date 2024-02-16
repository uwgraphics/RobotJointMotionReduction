import { Component, createRef } from "react";
import * as d3 from 'd3'; 
import { binarySearchIndexLargestSmallerEqual, binarySearchIndexSmallestGreaterEqual, euclideanDistance, findLargestSmallerElement, genSafeLogger, newID } from "../helpers";
import _ from 'lodash';
import Plot from 'react-plotly.js';
import { RobotSceneManager } from "../RobotSceneManager";
import { UmapGraph } from "../objects3D/UmapGraph";
import { Datum, LegendClickEvent, PlotDatum, PlotHoverEvent, PlotMouseEvent, PlotSelectionEvent } from "plotly.js";
import { Cluster, Clusterer } from "k-medoids";
import { StaticRobotScene } from "../scene/StaticRobotScene";
import { UmapPoint } from "../objects3D/UmapPoint";


/**
 * UmapLineGraph is similar to LineGraph, except the x-axis does not represent the
 * time data
 */
interface line_graph_props {
    robotSceneManager: RobotSceneManager,
    graph: UmapGraph,
    times: number[][], // the global time array that ignores the time range selected by the users
    // xVals: number[][],
    // yVals: number[][],
    jointData: number[][][],
    umapData: UmapPoint[][],
    startTime: number,
    endTime: number,
    currTime: number,
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of ids of lines graphed
    // prev_map: Map<string, number>, //maps line ids to index in line_names -> only includes lines that needed to be drawn
    line_colors: string[], //list of colors of lines graphed
    isTimeWarp: boolean,
    selected?: boolean // whether the current tab is selected or not
    width: number, 
    height: number,
    lineWidth: number,
    axisColor: string,
    showLines: Boolean,
    displayGap: Boolean,
    min2DGapDis: number,
    displayFalseProximity: Boolean,
    minHighDGapDis: number,
    showAllTraces: Boolean,
    onGraphUpdate: (updated:boolean) => boolean,
    onCurrChange: (newValue:number) => void,
    onStartChange: (newValue:number) => void,
    onEndChange: (newValue:number) => void,
    addNewStaticRobotCanvasPanel: (targetSceneIds: string[], showNineScenes: boolean) => void,
}


interface line_graph_state {
    // w: number,
    // h: number,
    zoomedTimes: number[][], // the time array that corresponds to the time range selected by the users
    zoomedUMAPData: Map<string, UmapPoint[]>, // key is the line id, value is the corresponding umap data presented in the graph
    prev_x: any,
    prev_y: any,
    margin: margin_obj,
    // prev_lines: Map<string, any>, //map line ids to line "object"
    // time_concat: number[],
    time_min: number,
    time_max: number,
    val_concat: number[],
    newCurr: number,
    
    mouseXCoord: number //only need x coordinate
    originalMouseXCoord: number
    currDragItem: dragItem;
    // umap_data: umap_data_entry[][];
    plotly_data: any[];
    plotly_layout: any;
    plotly_frames: any;
    plotly_config: any;
}
type dragItem = "end"|"start"|"curr"|null;
interface margin_obj{
    top: number,
    right: number, 
    bottom: number, 
    left: number 
}
interface PointInfo {
    x: number,
    y: number,
    curveNumber: number, 
    pointIndex: number,
}
export class UmapLineGraph extends Component<line_graph_props, line_graph_state> {
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected click_on_point: boolean; // true if the onplotlyclick function is called, stop event from propogating
    constructor(props:line_graph_props){
        super(props);
        this._graphDiv = createRef();
        this.click_on_point = false;
        // this.drawGraph.bind(this);
        const {width, height} = this.props;
        this.state = {
            // w: width,//+300,//1015,
            // h: height,//600,
            zoomedTimes: [],
            zoomedUMAPData: new Map(),
            prev_x: null,
            prev_y: null,
            margin: {
                top: 0,
                right: 10, 
                bottom: 20, 
                left: 10, // should be careful with this value as it can mess up the value along y axis
            },
            // prev_lines: new Map<string, any>(),
            // time_concat: [],
            time_min: -999,
            time_max: -999,
            val_concat: [],
            newCurr: this.props.currTime,
            mouseXCoord: -1,
            originalMouseXCoord: -1,
            currDragItem: null,
            // umap_data: [],
            plotly_data: [], 
            plotly_layout: {width: width, height: height, font: {color: "white"}, 
            plot_bgcolor:"rgb(23, 24, 25)", paper_bgcolor:"rgb(23, 24, 25)",
            yaxis: {
                showgrid: false
              },
            xaxis: {
                showgrid: false  
            }}, 
            plotly_frames: [], 
            plotly_config: {'scrollZoom': true},
        };
    }
    componentDidMount(): void {
        // if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
        //     this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
        // }
        // const {w, h} = this.state;
        const {height, width} = this.props;
        // const layout = { "width": 600, "height": 600 };

        // const data: Data[] = [];
        // data.push({
        //     x: [1, 2, 3, 4, 5],
        //     y: [6, 7, 10, -2, 52],
        //     name: "1",
        //     mode: 'markers',
        //     marker: {
        //         size: 2
        //     }
        // });
        // Plotly.react('UmapGraph', data, layout);
        // let svg = this.drawGraph(true, true);
        // if(svg){
        //     d3.select(this._graphDiv.current)
        //         .append("svg")
        //         .attr("width", width)
        //         .attr("height", height)
        //         .node().appendChild(svg);
        // }
        
    }
    componentDidUpdate(prevProps:line_graph_props) {

        const boundChangeInZoom =(prevProps.startTime !== this.props.startTime || prevProps.endTime !== this.props.endTime);
        let colorChange = !_.isEqual(new Set(prevProps.line_colors), new Set(this.props.line_colors)) && prevProps.line_colors.length === this.props.line_colors.length;
        let windowChanged = prevProps.height !== this.props.height || prevProps.width !== this.props.width;
        const currTimeChange = prevProps.currTime !== this.props.currTime;
        const lineWidthChange = prevProps.lineWidth !== this.props.lineWidth;
        const axisColorChange = prevProps.axisColor !== this.props.axisColor;
        if(windowChanged){
            this.setState({
                plotly_layout: {
                    width: this.props.width, height: this.props.height, font: { color: "white" },
                    plot_bgcolor: "rgb(23, 24, 25)", paper_bgcolor: "rgb(23, 24, 25)",
                    yaxis: {
                        showgrid: false
                    },
                    xaxis: {
                        showgrid: false
                    }
                },
            });
        }

        if (prevProps.showAllTraces !== this.props.showAllTraces) {
            this.dispalyAllTraces(this.props.showAllTraces.valueOf());
        }

        if (prevProps.displayGap !== this.props.displayGap) {
            if(this.props.displayGap.valueOf()){
                this.displayGaps(0.1, this.props.min2DGapDis);
            } else{
                this.removeGaps();
            }
        }

        if (prevProps.min2DGapDis !== this.props.min2DGapDis) {
            if(this.props.displayGap.valueOf()){
                this.displayGaps(0.1, this.props.min2DGapDis);
            }
                
        }

        if (prevProps.displayFalseProximity !== this.props.displayFalseProximity) {
            if(this.props.displayFalseProximity.valueOf()){
                this.displayFalseProximity(0.1, this.props.minHighDGapDis);
            } else{
                this.removeFalseProximity();
            }
        }

        if (prevProps.minHighDGapDis !== this.props.minHighDGapDis) {
            if(this.props.displayFalseProximity.valueOf()){
                this.displayFalseProximity(0.1, this.props.minHighDGapDis);
            }
        }

        if (prevProps.showLines !== this.props.showLines) {
            let plot_data = [];
            let mode = (this.props.showLines.valueOf()) ? 'lines+markers' : 'markers';
            for (const data of this.state.plotly_data) {
                if(data.id.startsWith("nneighbor") || data.id.startsWith("gap") 
                || data.id.startsWith("false proximity")){
                    plot_data.push(data);
                } else{
                    plot_data.push({
                        x: data.x,
                        y: data.y,
                        name: data.name,
                        id: data.id,
                        showlegend: true,
                        mode: mode,
                        marker: data.marker
                    });
                }
            }
            this.setState({
                plotly_data: plot_data,
            });
        }

        
        if (prevProps.times !== this.props.times || prevProps.umapData !== this.props.umapData ||
            colorChange || lineWidthChange || axisColorChange ||
            boundChangeInZoom) {
            // if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
            //     this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
            // }
            // const {w, h} = this.state;
            const {width, height} = this.props;
            this.calculateData(boundChangeInZoom, colorChange, windowChanged);
            // let svg = this.drawGraph(boundChangeInZoom, colorChange, windowChanged);
            // // log(svg);
            // // console.log("width " + w + " height " + h);
            // if(svg){
            //     d3.select(this._graphDiv.current)
            //         .append("svg")
            //         .attr("width", width)
            //         .attr("height", height)
            //         .node().appendChild(svg);
            // }
            
            // this.drawGraph();
        }
        
    }

    /**
     * filter the data based on the current start time and end time
     * @param startTime 
     * @param endTime 
     * @returns 
     */
    filterData(startTime: number, endTime: number): [number[][], UmapPoint[][]]
    {
        let zoomedTimes: number[][] = [], zoomedUmapData: UmapPoint[][] = [];
        const {times, umapData} = this.props;
        if(times.length === 0){
            return [[[]], [[]]];
        }
        
        for (let i = 0; i < times.length; i++) {
            let index = 0;
            zoomedTimes[i] = [];
            zoomedUmapData[i] = [];
            // zoomedXValues[i] = [];
            // zoomedYValues[i] = [];
            let startIndex = binarySearchIndexSmallestGreaterEqual(times[i], startTime);
            let endIndex = binarySearchIndexLargestSmallerEqual(times[i], endTime);
            if(startIndex === undefined) startIndex = 0;
            if(endIndex === undefined) endIndex = times[i].length - 1;
            for (let j = startIndex; j < endIndex; j++) {
                
                zoomedTimes[i][index] = times[i][j];
                // zoomedXValues[i][index] = xVals[i][j];
                // zoomedYValues[i][index] = yVals[i][j];
                zoomedUmapData[i][index] = umapData[i][j];
                index++;
            }
        }
        // console.log(vals);
        return [zoomedTimes, zoomedUmapData]
    }


    /**
     * draws everything in the graph using d3
     * @param boundChangeInZoom 
     * @param colorChange 
     * @param windowChanged 
     * @returns svg node component
     */
    calculateData(boundChangeInZoom?:boolean, colorChange?:boolean, windowChanged?:boolean):any{
        // return 1;
        const {times,
            startTime, endTime, currTime, 
            isTimeWarp, lineWidth, axisColor,
            line_names, line_colors, line_ids,
            onGraphUpdate} = this.props;
        const w = this.props.width;
        const h = this.props.height;
        const isDataChanged = true;
        
        const {margin, prev_x, prev_y} = this.state;
        //width = w - margin.left - margin.right,
        const width = w - margin.left - margin.right,
        height = h - margin.top - margin.bottom;

        let [zoomedTimes, data] = this.filterData(startTime, endTime);
      
       
        onGraphUpdate(true);
        let plot_data = [];
        let mode = (this.props.showLines.valueOf()) ? 'lines+markers' : 'markers';
        let UmapData: Map<string, UmapPoint[]> = new Map();
        for(let i=0; i<data.length; i++){
            let x = [], y = [];
            for(const point of data[i]){
                const pointIn2D = point.pointIn2D();
                x.push(pointIn2D[0]);
                y.push(pointIn2D[1]);
            }
            plot_data.push({
                x: x,
                y: y,
                name: line_names[i],
                id: line_ids[i],
                showlegend: true,
                mode: mode,
                marker: {
                    size: 2
                }
            });
            UmapData.set(line_ids[i], data[i]);
        }
        this.setState({
            plotly_data: plot_data,
            zoomedTimes: zoomedTimes,
            zoomedUMAPData: UmapData,
        });
    }


    /**
     * hover event handler
     * whenever users hover on a point, set the global time to the corresponding point
     * @param event 
     */
    onPlotlyHover(event: Readonly<PlotHoverEvent>) {
        const {plotly_data} = this.state;
        let line_idx: number = -1, point_idx: number = -1;
        for (var i = 0; i < event.points.length; i++) {
            line_idx = event.points[i].curveNumber;
            let line_id: string = plotly_data[line_idx].id;
            if(line_id.startsWith("nneighbor")) continue;
            point_idx = event.points[i].pointIndex;
        }
        if(point_idx !== -1){
            let selected_time = this.state.zoomedTimes[0][point_idx]
            this.props.robotSceneManager.setCurrTime(selected_time);
        }
    }

    onPanelClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>){
        if(this.click_on_point) event.stopPropagation();
        this.click_on_point = false;
    }

    /**
     * click event handler
     * whenever users clicks a point, show its n-neighbors
     * unless it is a hightlighted n-neighbors point
     * @param event 
     */
    onPlotlyClick(event: Readonly<PlotMouseEvent>) {
        this.click_on_point = true;
        event.event.stopPropagation();
        const {plotly_data, zoomedUMAPData} = this.state;
        let line_idx: number = 0, point_idx: number = 0, point_x = 0, point_y = 0;
        for (let i = 0; i < event.points.length; i++) {
            line_idx = event.points[i].curveNumber;
            point_idx = event.points[i].pointIndex;
            point_x = event.points[i].x as number;
            point_y = event.points[i].y as number;
        }
        let line_id: string = plotly_data[line_idx].id;
        if(line_id.startsWith("nneighbor") || line_id.startsWith("gap") || line_id.startsWith("false proximity")) return;

        let plot_data = [], points: PointInfo[] = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            plot_data.push(data);
            for(let j=0; j<data.x.length; j++){
                points.push({x: data.x[j], y: data.y[j], curveNumber: i, pointIndex: j, });
            }
        }

        let trace = zoomedUMAPData.get(line_id);
        if(trace === undefined) return;
        let point_selected: UmapPoint = trace[point_idx]; // the Umap point that is clicked on by the user

        let nneighbors = point_selected.nneighborsInHD().keys();
        let nneighbors_id = "nneighbors-before reduction" + newID(), nneighbors_name = "nneighbors"+ "<br>" + "before reduction";
        if(!this.props.graph.nneighborMode().valueOf()){
            // show nneighbors after reduction
            nneighbors = point_selected.nneighborsIn2D().keys();
            nneighbors_id = "nneighbors-after reduction" + newID();
            nneighbors_name = "nneighbors"+ "<br>" + "after reduction";
        }
        let nneighbors_points: number[][] = [];
        for(const nneighbor of nneighbors)
            nneighbors_points.push(nneighbor.pointIn2D())
        let selectedPoints: UmapPoint[] = [];
        selectedPoints.push(point_selected)
        if (nneighbors_points.length > 8) {  
            // find 9 clusters and use the first point in every cluster to represent the cluster
            const clusterer = Clusterer.getInstance(nneighbors_points, 8);
            for (const data of clusterer.Medoids) {
                let point = this.findPoints(data, points);
                if(point !== undefined) selectedPoints.push(point);
            }
        } else{
            for(const data of nneighbors_points){
                let point = this.findPoints(data, points);
                if(point !== undefined) selectedPoints.push(point);
            }
        }
        if(selectedPoints.length > 4){  // make sure that the robot pose corresponding to the selected point is in the middle
            let temp = selectedPoints[4];
            selectedPoints[4] = selectedPoints[0];
            selectedPoints[0] = temp;
        }
        // console.log(selectedPoints);
        this.showRobotScenes(selectedPoints, true);
        
        let x = [], y = [];
        for (const point of nneighbors_points) {
            x.push(point[0]);
            y.push(point[1]);
        }
        plot_data.push({
            x: x,
            y: y,
            name: nneighbors_name,
            id: nneighbors_id,
            showlegend: true,
            mode: "markers",
            marker: {
                size: 8,
                opacity: 0.5,
            }
        });
        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * legend click handler
     * whenever users click the legend, if the corresponding trace is gap, then display the window
     * @param event 
     * @returns 
     */
    onPlotlyLegendClick(event: Readonly<LegendClickEvent>) {
        const { graph, robotSceneManager } = this.props;
        const { plotly_data } = this.state;
        let line_id: string = plotly_data[event.curveNumber].id;
        if((line_id.startsWith("gap") || line_id.startsWith("false proximity"))&& plotly_data[event.curveNumber].visible !== true){
            const [, point1_id, point2_id] = line_id.split("#");
            let point1 = graph.getUmapPoint(point1_id);
            let point2 = graph.getUmapPoint(point2_id);
            if (point1 !== undefined && point2 !== undefined) {
                this.showRobotScenes([point1, point2], false);
            }
        }
        return true;
    }

    /**
     * legend double click handler
     * whenever users double click the legend, the corresponding line will be deleted
     * @param event 
     * @returns 
     */
    onPlotlyLegendDoubleClick(event: Readonly<LegendClickEvent>) {
        const { line_ids, line_colors, graph } = this.props;
        const { plotly_data } = this.state;
        let line_id: string = plotly_data[event.curveNumber].id;

        let index = -1;
        for (let i = 0; i < line_ids.length; i++)
            if (line_ids[i] === line_id) {
                index = i;
                break;
            }
        if (index > -1) {
            graph.setDeleteLine(line_ids[index], line_colors[index]);
        } else{
            // if (line_id.startsWith("nneighbor")) {
                let plot_data = [];
                for (let i = 0; i < plotly_data.length; i++) {
                    if(i === event.curveNumber) continue;
                    let data = plotly_data[i];
                    plot_data.push(data);
                }
                this.setState({
                    plotly_data: plot_data,
                });
            // }
        }
        console.log(event.data[event.curveNumber]);
        return false;
    }

    /**
     * find the point corresponding to the data in clusteredData
     * @param clusteredData 
     * @param points 
     * @returns 
     */
    findPoints(clusteredData: Datum[], points: PlotDatum[] | PointInfo[]): UmapPoint | undefined{
        const {plotly_data, zoomedUMAPData} = this.state;
        for(const point of points){
            if(clusteredData[0] === point.x && clusteredData[1] === point.y 
                && typeof point.x === "number" && typeof point.y === "number"){
                    let line_id = plotly_data[point.curveNumber].id;
                    let trace = zoomedUMAPData.get(line_id);
                    if(trace !== undefined) return trace[point.pointIndex];
            }
        }
    }

    /**
     * selected event handler (can be either box select or Lasso select) 
     * first calculate 9 points that can best represent the data
     * (if less than 9, then use all points), then show the robot motion
     * correspond to these points
     * @param event 
     */
    onPlotlySelected(event: Readonly<PlotSelectionEvent>){
        if(event === undefined || event.points === undefined) return;
        let points = event.points;
        if(points.length === 0) return;

        const {zoomedUMAPData, plotly_data} = this.state;
        let selectedPoints: UmapPoint[] = [];
        if(points.length > 9){
            let data = [];
            for(const point of points)
                data.push([point.x, point.y])
            // find 9 clusters and use the first point in every cluster to represent the cluster
            const clusterer = Clusterer.getInstance(data, 9);
            //const clusteredData = clusterer.getClusteredData();  
            for(const data of clusterer.Medoids){
                let point = this.findPoints(data, points);
                if(point !== undefined) selectedPoints.push(point);
            }
        } else{
            for(const point of points){
                let line_id = plotly_data[point.curveNumber].id;
                let trace = zoomedUMAPData.get(line_id);
                if(trace !== undefined)
                    selectedPoints.push(trace[point.pointIndex]);
            }
        }
        this.showRobotScenes(selectedPoints, true);
    }

    /**
     * display robots corresponding to the point from the {curveNumber[i]}th curve
     * at index {pointIndices[i]} in 3D scene(s)
     * @param selectedPoints 
     * @returns 
     */
    showRobotScenes(selectedPoints: UmapPoint[], showNineScenes: boolean){
        const { line_ids, line_colors, graph, times, robotSceneManager } = this.props;
        const { plotly_data, zoomedTimes } = this.state;
        let sceneIds = [];
        // let showNineScenes = graph.showNineScenes().valueOf();
        if(showNineScenes){ // create nine scenes to show the robots
            for (const point of selectedPoints) {
                let newSceneId = newID();
                let staticRobotScene = new StaticRobotScene(robotSceneManager, newSceneId);
                sceneIds.push(newSceneId);

                const [sceneId, robotName] = this.decomposeId(point.robotInfo());
                let scene = robotSceneManager.robotSceneById(sceneId);
                if (scene === undefined) return;
                if (!robotSceneManager.isActiveRobotScene(scene))
                    robotSceneManager.activateRobotScene(scene);
                let robot = scene.getRobotByName(robotName);
                if (robot !== undefined) staticRobotScene.addChildRobot(robot, point.time());
            }
        }
        //} else{ // create one scene to show the robots
            let sceneId = newID();
            let staticRobotScene = new StaticRobotScene(robotSceneManager, sceneId);
            sceneIds.push(sceneId);
            for (const point of selectedPoints) {
                const [sceneId, robotName] = this.decomposeId(point.robotInfo());
                let scene = robotSceneManager.robotSceneById(sceneId);
                if (scene === undefined) return;
                if (!robotSceneManager.isActiveRobotScene(scene))
                    robotSceneManager.activateRobotScene(scene);
                let robot = scene.getRobotByName(robotName);
                if (robot !== undefined) {
                    staticRobotScene.addChildRobot(robot, point.time());
                    robot.setOpacity(0.5);
                }
            }
        //}
        this.props.addNewStaticRobotCanvasPanel(sceneIds, showNineScenes);
        this.props.robotSceneManager.setShouldSyncViews(true);
    }

    
    /**
     * connect two points that are ajacent in their original high dimension
     * but their distance in 2D is greater than min_dis
     * @param min_dis 
     */
    displayGaps(max_dis_HD: number, min_dis_2D: number){
        const { plotly_data } = this.state;

        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            plot_data.push(data);
        }

        let zoomedUMAPData = [];
        for(const [i, data] of plotly_data.entries()){
            let line_id = data.id;
            let umapData = this.state.zoomedUMAPData.get(line_id);
            if(umapData !== undefined) zoomedUMAPData.push(umapData);
        }

        let gaps: number = 0;
        for(const trace of zoomedUMAPData){
            for(const data of trace){
                for(const [neighbor, distance] of data.nneighborsInHD()){
                    if(distance.distanceIn2D() > min_dis_2D && distance.distanceInHD() <= max_dis_HD){
                        plot_data.push({
                            x: [data.pointIn2D()[0], neighbor.pointIn2D()[0]],
                            y: [data.pointIn2D()[1], neighbor.pointIn2D()[1]],
                            id: "gap#" + data.id() + "#" + neighbor.id(),
                            name: "gap-" + gaps,
                            mode: "lines",
                            visible: "legendonly",
                            line: {
                                color: 'rgb(219, 64, 82)',
                                width: 3,
                            }
                        });
                        gaps++;
                    }
                }

                for(const [prevPoint, distance] of data.prevPoint()){
                    if(distance.distanceIn2D() > min_dis_2D){
                        plot_data.push({
                            x: [data.pointIn2D()[0], prevPoint.pointIn2D()[0]],
                            y: [data.pointIn2D()[1], prevPoint.pointIn2D()[1]],
                            id: "gap#" + data.id() + "#" + prevPoint.id(),
                            name: "gap-" + gaps,
                            mode: "lines",
                            visible: "legendonly",
                            line: {
                                color: 'rgb(219, 64, 82)',
                                width: 3,
                            }
                        });
                        gaps++;
                    }
                }
            }
        }

        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * remove all the lines that connect the gaps
     */
    removeGaps(){
        const { plotly_data } = this.state;
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            let id = data.id as string;
            if(id.startsWith("gap")) continue;
            plot_data.push(data);
        }

        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * show two points that are ajacent (distance smaller than max_dis_2D) in 2D
     * but their distance in original high dimension is greater than min_dis_HD
     * @param max_dis_2D
     * @param min_dis_HD 
     */
    displayFalseProximity(max_dis_2D: number, min_dis_HD: number){
        const { plotly_data} = this.state;
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            plot_data.push(data);
        }
        let zoomedUMAPData = [];
        for(const [i, data] of plotly_data.entries()){
            let line_id = data.id;
            let umapData = this.state.zoomedUMAPData.get(line_id);
            if(umapData !== undefined) zoomedUMAPData.push(umapData);
        }

        let false_proximities: number = 0;
        for(const trace of zoomedUMAPData){
            for(const data of trace){
                for(const [neighbor, distance] of data.nneighborsIn2D()){
                    if(distance.distanceInHD() > min_dis_HD && distance.distanceIn2D() <= max_dis_2D){
                        plot_data.push({
                            x: [data.pointIn2D()[0], neighbor.pointIn2D()[0]],
                            y: [data.pointIn2D()[1], neighbor.pointIn2D()[1]],
                            id: "false proximity#" + data.id() + "#" + neighbor.id(),
                            name: "false proximity-" + false_proximities,
                            mode: "markers",
                            visible: "legendonly",
                            marker: {
                                color: 'rgb(195, 178, 153)',
                            }
                        });
                        false_proximities++;
                    }
                }
            }
        }

        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * remove all false proximity points
     */
    removeFalseProximity(){
        const { plotly_data } = this.state;
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            let id = data.id as string;
            if(id.startsWith("false proximity")) continue;
            plot_data.push(data);
        }

        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * 
     * @param show true if show all traces, false if hide them
     */
    dispalyAllTraces(show: boolean){
        console.log("display all traces");
        const { plotly_data } = this.state;
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            let id = data.id as string;
            if(id.startsWith("gap") || id.startsWith("false proximity")){
                plot_data.push(data);
                continue;
            }
            plot_data.push({
                x: data.x,
                y: data.y,
                name: data.name,
                id: data.id,
                showlegend: data.showlegend,
                mode: data.mode,
                marker: data.marker,
                visible: show,
            });
        }

        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * decompose the id of the drag button
     * to sceneId, robotName, partName
     * @param eventName
     * @returns 
     */
    decomposeId(eventName:string)
    {
        const [sceneId, robotName] = eventName.split("#");
        return [sceneId, robotName];
    }


    render() {
        //const {w, h} = this.state;
        const {isTimeWarp, times, selected, axisColor, width, height, line_names} = this.props;
        // const {umap_data} = this.state;
        const {plotly_config, plotly_data, plotly_frames, plotly_layout} = this.state;

        return (
            <div>
                <div style={{textAlign: "center"}}>
                </div>
                <div className="UmapGraph" id="UmapGraph" ref={this._graphDiv} onClick={(event) => this.onPanelClick(event)}>
                <Plot
                    data={plotly_data}
                    layout={plotly_layout}
                    frames={plotly_frames}
                    config={plotly_config}
                    onHover={(event) => this.onPlotlyHover(event)}
                    onClick={(event) => this.onPlotlyClick(event)}
                    onLegendClick={(event) => this.onPlotlyLegendClick(event)}
                    onLegendDoubleClick={(event) => this.onPlotlyLegendDoubleClick(event)}
                    onInitialized={(figure) => this.setState({
                        plotly_data: figure.data,
                        plotly_layout: figure.layout,
                        plotly_frames: figure.frames
                    })}
                    onUpdate={(figure) => this.setState({
                        plotly_data: figure.data,
                        plotly_layout: figure.layout,
                        plotly_frames: figure.frames
                    })}
                    onSelected={(event) => this.onPlotlySelected(event)}
                />
                </div>
            </div>
        );
    }
}
