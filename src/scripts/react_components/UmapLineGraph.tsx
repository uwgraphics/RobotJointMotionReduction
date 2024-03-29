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
import { Distances, UmapPoint } from "../objects3D/UmapPoint";
import chroma from 'chroma-js';


/**
 * UmapLineGraph is similar to LineGraph, except the x-axis does not represent the
 * time data
 */
interface line_graph_props {
    robotSceneManager: RobotSceneManager,
    graph: UmapGraph,
    times: number[][], // the global time array that ignores the time range selected by the users
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
    displayStretch: Boolean,
    min2DStretchDis: number,
    displayFalseProximity: Boolean,
    minHighDGapDis: number,
    showAllTraces: Boolean,
    backgroundPoints: UmapPoint[],
    neighborDistance: number,
    displayNeighbors: Boolean,
    displayPointsInRegion: Boolean,
    displaySpeed: Boolean,
    onGraphUpdate: (updated:boolean) => boolean,
    onCurrChange: (newValue:number) => void,
    onStartChange: (newValue:number) => void,
    onEndChange: (newValue:number) => void,
    addNewStaticRobotCanvasPanel: (targetSceneIds: string[], showNineScenes: boolean, selectedPointsNames: string[]) => void,
    removeTab: (tabId: string) => void,
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
    protected selectedPointsCount: number; // the count of the total selected points shown in the scene
    protected selectedPointsMap: Map<string, string>; // store the mapping of the id of selected points to the id of the corresponding static robot scene
    constructor(props:line_graph_props){
        super(props);
        this._graphDiv = createRef();
        this.click_on_point = false;
        this.selectedPointsCount = 0;
        this.selectedPointsMap = new Map();
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

        if (prevProps.displayStretch !== this.props.displayStretch) {
            if(this.props.displayStretch.valueOf()){
                this.displayStretches(0.1, this.props.min2DStretchDis);
            } else{
                this.removeStretches();
            }
        }

        if (prevProps.min2DStretchDis !== this.props.min2DStretchDis) {
            if(this.props.displayStretch.valueOf()){
                this.displayStretches(0.1, this.props.min2DStretchDis);
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

        if(prevProps.neighborDistance !== this.props.neighborDistance){
            this.filterNeighbors();
        }

        if(prevProps.displayNeighbors !== this.props.displayNeighbors){
            if(!this.props.displayNeighbors.valueOf()){
                this.removeAllNeighbors();
                this.props.graph.toggleDisplayNeighbors();
            }
        }

        if(prevProps.displayPointsInRegion !== this.props.displayPointsInRegion){
            if(!this.props.displayPointsInRegion.valueOf()){
                this.removeAllPointsInRegion();
                this.props.graph.toggleDisplayPointsInRegion();
            }
        }

        if (prevProps.displaySpeed !== this.props.displaySpeed) {
            this.calculateData(this.props.displaySpeed.valueOf());
        }


        if (prevProps.showLines !== this.props.showLines) {
            let plot_data = [];
            let mode = (this.props.showLines.valueOf()) ? 'lines+markers' : 'markers';
            for (const data of this.state.plotly_data) {
                if(data.id.startsWith("nneighbor") || data.id.startsWith("gap") || data.id.startsWith("stretch") 
                || data.id.startsWith("false proximity") || data.id.startsWith("backgroundPoints") 
                || data.id.startsWith("selected points")){
                    plot_data.push(data);
                } else if(data.id.startsWith("speed")){
                    plot_data.push({
                        x: data.x,
                        y: data.y,
                        name: data.name,
                        id: data.id,
                        showlegend: data.showlegend,
                        legendgroup: data.legendgroup,
                        mode: mode,
                        marker: data.marker
                    });
                } else{
                    plot_data.push({
                        x: data.x,
                        y: data.y,
                        name: data.name,
                        id: data.id,
                        showlegend: data.showlegend,
                        mode: mode,
                        marker: data.marker,
                        line: data.line
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
            this.calculateData(this.props.displaySpeed.valueOf());
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
     * draw the traces under the current time frames
     */
    calculateData(displaySpeed: boolean){
        // return 1;
        const {times,
            startTime, endTime, currTime, 
            isTimeWarp, lineWidth, axisColor,
            line_names, line_colors, line_ids,
            onGraphUpdate, umapData, backgroundPoints} = this.props;

        let [zoomedTimes, data] = this.filterData(startTime, endTime);
      
       
        onGraphUpdate(true);
        let plot_data = [];
        let mode = (this.props.showLines.valueOf()) ? 'lines+markers' : 'markers';
        let UmapData: Map<string, UmapPoint[]> = new Map();
        if (displaySpeed) {
            for (let i = 0; i < data.length; i++) {
                for (let j = 1; j < data[i].length; j++) {
                    let x = [], y = [];
                    const pointIn2D = data[i][j - 1].pointIn2D();
                    const pointIn2D2 = data[i][j].pointIn2D();
                    x.push(pointIn2D[0], pointIn2D2[0]);
                    y.push(pointIn2D[1], pointIn2D2[1]);
                    let showlegend = (j === 1) ? true : false;
                    // higher speed will have lighter color
                    let color = chroma(line_colors[i]).brighten(data[i][j].speedRatio() * 3).hex();
                    plot_data.push({
                        x: x,
                        y: y,
                        name: line_names[i],
                        id: "speed" + line_ids[i],
                        showlegend: showlegend,
                        legendgroup: line_names[i],
                        mode: mode,
                        marker: {
                            size: 4,
                            color: color,
                        },
                        line: {
                            color: color,
                        }
                    });
                }

                UmapData.set(line_ids[i], data[i]);
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                let x = [], y = [];
                for (const point of data[i]) {
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
                        size: 4,
                        color: line_colors[i],
                    },
                    line: {
                        color: line_colors[i],
                    }
                });
                UmapData.set(line_ids[i], data[i]);
            }
        }


        let x = [], y = [];
        for (const point of backgroundPoints) {
            const pointIn2D = point.pointIn2D();
            x.push(pointIn2D[0]);
            y.push(pointIn2D[1]);
        }
        plot_data.push({
            x: x,
            y: y,
            name: "backgroundPoints",
            id: "backgroundPoints",
            visible: "legendonly",
            mode: "markers",
            marker: {
                size: 4,
                color: "grey",
            }
        });

        this.setState({
            plotly_data: plot_data,
            zoomedTimes: zoomedTimes,
            zoomedUMAPData: UmapData,
        });
    }

    /**
     * find the hovered_point in the neighbors of the point
     * @param point 
     * @param hovered_point 
     * @param before_reduction 
     * @returns 
     */
    findNeighborPoints(point: UmapPoint, hovered_point: Datum[], before_reduction: boolean): UmapPoint | undefined{
        let nneighbors = point.nneighborsIn2D();
        if(before_reduction) nneighbors = point.nneighborsInHD();
        for(const [neighbor, distance] of nneighbors){
            if(neighbor.pointIn2D()[0] === hovered_point[0] && 
                neighbor.pointIn2D()[1] === hovered_point[1])
                return neighbor;
        }
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
            if(line_id.startsWith("gap") || line_id.startsWith("false proximity") 
            || line_id.startsWith("backgroundPoints") || line_id.startsWith("points in region")
            || line_id.startsWith("speed")) continue;
            if(line_id.startsWith("nneighbor")) {
                let [, point_id] = line_id.split("#");
                let point = this.props.graph.getUmapPoint(point_id);
                if(point === undefined) continue;
                let neighbor = this.findNeighborPoints(point, [event.points[i].x, event.points[i].y], line_id.startsWith("nneighbors-before reduction"));
                if(neighbor !== undefined) {
                    this.props.robotSceneManager.setCurrTime(neighbor.time());
                    return;
                }
            }
            if(line_id.startsWith("selected points")){
                let [, , point_id] = line_id.split("#");
                let sceneId = this.selectedPointsMap.get(point_id);
                if(sceneId === undefined) continue;
                // let scene = this.props.robotSceneManager.getStaticRobotSceneById(sceneId);
                // if(scene === undefined) continue;
                this.props.robotSceneManager.setCurrStaticRobotScene(sceneId);
                return;
            }
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
        if(line_id.startsWith("nneighbor") || line_id.startsWith("gap") 
        || line_id.startsWith("false proximity") || line_id.startsWith("selected points")
        || line_id.startsWith("points in region") || line_id.startsWith("speed")) return;

        let plot_data = [], points: PointInfo[] = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            plot_data.push(data);
            for(let j=0; j<data.x.length; j++){
                points.push({x: data.x[j], y: data.y[j], curveNumber: i, pointIndex: j, });
            }
        }

        let trace = zoomedUMAPData.get(line_id);
        if(trace === undefined) {
            if(line_id.startsWith("backgroundPoints")){
                trace = this.props.backgroundPoints;
            } else return;
        };
        let point_selected: UmapPoint = trace[point_idx]; // the Umap point that is clicked on by the user
        this.props.graph.setMaxNeighborDistance(point_selected.maxNeighborDistance());
        // console.log(point_selected.maxNeighborDistance())
        // console.log(this.props.graph.maxNeighborDistance())
        // console.log(this.props.graph.neighborDistance())
        this.displayNeighbors(plot_data, point_selected, points);

        this.setState({
            plotly_data: plot_data,
        });
    }

    displayNeighbors(plot_data: any[], point_selected: UmapPoint, points: PointInfo[]){
        let nneighbors = point_selected.nneighborsInHD();
        let nneighbors_id = "nneighbors-before reduction#" + point_selected.id(), nneighbors_name = "nneighbors"+ "<br>" + "before reduction";
        if(!this.props.graph.nneighborMode().valueOf()){
            // show nneighbors after reduction
            nneighbors = point_selected.nneighborsIn2D();
            nneighbors_id = "nneighbors-after reduction#" + point_selected.id();
            nneighbors_name = "nneighbors"+ "<br>" + "after reduction";
        }
        let nneighbors_points: number[][] = [];
        // console.log(this.props.graph.neighborDistance())
        for(const [nneighbor, distance] of nneighbors){
            if((this.props.graph.nneighborMode().valueOf() && distance.distanceInHD() <= this.props.graph.neighborDistance())
                || (!this.props.graph.nneighborMode().valueOf() && distance.distanceIn2D() <= this.props.graph.neighborDistance())) 
                nneighbors_points.push(nneighbor.pointIn2D())
        }
            
        let selectedPoints: UmapPoint[] = [];
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
        
        // console.log(selectedPoints);
        
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

        plot_data.push({
            x: [point_selected.pointIn2D()[0]],
            y: [point_selected.pointIn2D()[1]],
            name: "selected points - clicked",
            id: "selected points#neighbors#" + point_selected.id(),
            showlegend: true,
            mode: "markers",
            marker: {
                size: 16,
                opacity: 0.3,
            }
        });
        let selectedPointsNames = this.addSelectedPoints(plot_data, selectedPoints, true);
        selectedPoints.push(point_selected)
        selectedPointsNames.push("selected points - clicked");
        
        if(selectedPoints.length > 4){  // make sure that the robot pose corresponding to the selected point is in the middle
            let temp = selectedPoints[4];
            selectedPoints[4] = selectedPoints[selectedPoints.length-1];
            selectedPoints[selectedPoints.length-1] = temp;
            let temp2 = selectedPointsNames[4];
            selectedPointsNames[4] = selectedPointsNames[selectedPointsNames.length-1];
            selectedPointsNames[selectedPointsNames.length-1] = temp2;
        }
        this.showRobotScenes(selectedPoints, selectedPointsNames, true, newID(), [], []);
    }

    removeAllNeighbors(){
        const { plotly_data } = this.state;
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            if(!data.id.startsWith("nneighbors") && !data.id.startsWith("selected points#neighbors"))
                plot_data.push(data);
        }
        this.setState({
            plotly_data: plot_data,
        });
    }

    filterNeighbors(){
        const { graph } = this.props;
        const { plotly_data } = this.state;
        let plot_data = [], points: PointInfo[] = [];
        let selectedPoints: Set<UmapPoint> = new Set(); 
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            for(let j=0; j<data.x.length; j++){
                points.push({x: data.x[j], y: data.y[j], curveNumber: i, pointIndex: j, });
            }
            if(data.id.startsWith("nneighbors")){
                let [, point_selected_id] = data.id.split("#");
                let point_selected = graph.getUmapPoint(point_selected_id);
                if(point_selected === undefined) continue;
                selectedPoints.add(point_selected);
            } else if(data.id.startsWith("selected points#neighbors")){
                this.selectedPointsCount--;
                continue;
            } 
            else plot_data.push(data);
        }
        for(const selected_point of selectedPoints)
            this.displayNeighbors(plot_data, selected_point, points);
        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * add selected points to the plotly data
     * @param plot_data 
     * @param selectedPoints 
     * @returns a string array that stores all their name
     */
    addSelectedPoints(plot_data: any[], selectedPoints: UmapPoint[], neighbors: boolean): string[] {
        let selectedPointsNames: string[] = [];
        for(const point of selectedPoints){
            let pointName = "selected points " + this.selectedPointsCount;
            let pointId = "selected points#" + (neighbors?"neighbors":"region") + "#" + point.id();
            this.selectedPointsCount++;
            selectedPointsNames.push(pointName)
            plot_data.push({
                x: [point.pointIn2D()[0]],
                y: [point.pointIn2D()[1]],
                name: pointName,
                id: pointId,
                showlegend: true,
                mode: "markers",
                marker: {
                    size: 16,
                    opacity: 0.3,
                }
            });
        }
        return selectedPointsNames;
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
        if((line_id.startsWith("gap") || line_id.startsWith("false proximity")) || line_id.startsWith("stretch")){
            const [, point1_id, point2_id] = line_id.split("#");
            let point1 = graph.getUmapPoint(point1_id);
            let point2 = graph.getUmapPoint(point2_id);
            if (point1 !== undefined && point2 !== undefined) {
                if(plotly_data[event.curveNumber].visible !== true)
                    this.showRobotScenes([point1, point2], [], false, line_id, [], []);
                else{
                    this.props.removeTab("StaticRobotScene-One&" + line_id);
                }
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
            if(line_id.startsWith("selected points")) this.selectedPointsCount--;
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
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            plot_data.push(data);
        }
        let x = [], y = [];
        for (const point of points) {
            x.push(point.x);
            y.push(point.y);
        }
        plot_data.push({
            x: x,
            y: y,
            name: "points in region",
            id: "points in region",
            showlegend: true,
            mode: "markers",
            marker: {
                size: 8,
                opacity: 0.5,
            }
        });

        let allPoints: UmapPoint[] = [];
        let colors: string[] = [];
        for(const point of points){
            let line_id = plotly_data[point.curveNumber].id;
            let trace = zoomedUMAPData.get(line_id);
            colors.push(plotly_data[point.curveNumber].marker.color)
            if(trace !== undefined)
                allPoints.push(trace[point.pointIndex]);
        }
        let selectedPointsNames = this.addSelectedPoints(plot_data, selectedPoints, false);
        this.showRobotScenes(selectedPoints, selectedPointsNames, true, newID(), allPoints, colors);
        this.setState({
            plotly_data: plot_data
        });
    }

    removeAllPointsInRegion(){
        const { plotly_data } = this.state;
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            if(!data.id.startsWith("points in region") && !data.id.startsWith("selected points#region"))
                plot_data.push(data);
        }
        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * display robots corresponding to the point from the {curveNumber[i]}th curve
     * at index {pointIndices[i]} in 3D scene(s)
     * @param selectedPoints 
     * @param selectedPointsNames the name of each point; since I do not want to use the id of the points as its name, this string array is needed
     * @param showNineScenes true if show ninescenes, otherwise false
     * @param oneSceneId the sceneId of the gaps and the false proximity will be specified so that the scene can be deleted automatically
     * @returns 
     */
    showRobotScenes(selectedPoints: UmapPoint[], selectedPointsNames: string[],  showNineScenes: boolean, oneSceneId: string, allPoints: UmapPoint[], allPointsColors: string[]){
        const { line_ids, line_colors, graph, times, robotSceneManager } = this.props;
        const { plotly_data, zoomedTimes } = this.state;
        let sceneIds = [];
        // let showNineScenes = graph.showNineScenes().valueOf();
        if(showNineScenes){ // create nine scenes to show the robots
            for (const point of selectedPoints) {
                let newSceneId = newID();
                let staticRobotScene = new StaticRobotScene(robotSceneManager, newSceneId);
                sceneIds.push(newSceneId);
                this.selectedPointsMap.set(point.id(), newSceneId);

                const [sceneId, robotName] = this.decomposeId(point.robotInfo());
                let scene = robotSceneManager.robotSceneById(sceneId);
                if (scene === undefined) return;
                if (!robotSceneManager.isActiveRobotScene(scene))
                    robotSceneManager.activateRobotScene(scene);
                let robot = scene.getRobotByName(robotName);
                if (robot !== undefined) staticRobotScene.addChildRobot(robot, point.time());
            }
        }
        // create one scene to show the robots
        let sceneId = newID();
        if (oneSceneId !== undefined) sceneId = oneSceneId;
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


        // add traces to the scene
        let selectedRobotJointName = graph.selectedRobotJointName();
        if ( selectedRobotJointName.length > 0) {
            let traceMap: Map<UmapPoint, number[]> = new Map();
            let colorMap: Map<UmapPoint, string> = new Map();
            let visited: Set<UmapPoint> = new Set();
            let pointsSet: Set<UmapPoint> = new Set();
            for (const point of allPoints) pointsSet.add(point);
            for (const [i, point] of allPoints.entries()) { // find points that are adjacent so they can be shown in the same trace
                if (visited.has(point)) continue;
                visited.add(point);
                let trace = [];
                let currPoint = point;
                while (pointsSet.has(currPoint)) {
                    traceMap.delete(currPoint);
                    colorMap.delete(currPoint);
                    trace.unshift(currPoint.time());
                    visited.add(currPoint);
                    let prevPoint;
                    for (const [prev_point, distance] of currPoint.prevPoint()) {
                        prevPoint = prev_point;
                    }
                    if (prevPoint === undefined || prevPoint === currPoint) break;
                    currPoint = prevPoint;
                }
                traceMap.set(point, trace);
                colorMap.set(point, allPointsColors[i]);
            }
            for (const [point, trace] of traceMap) {
                console.log(trace);
                const [sceneId, robotName] = this.decomposeId(point.robotInfo());
                let scene = robotSceneManager.robotSceneById(sceneId);
                if (scene === undefined) return;
                if (!robotSceneManager.isActiveRobotScene(scene))
                    robotSceneManager.activateRobotScene(scene);
                let robot = scene.getRobotByName(robotName);
                if (robot !== undefined) {
                    let color = colorMap.get(point);
                    let selectedRobotJoint = robot.getArticuatedJointMap().get(selectedRobotJointName);
                    if(selectedRobotJoint !== undefined)
                        staticRobotScene.addTraces(robot, trace, selectedRobotJoint, (color === undefined) ? "red" : color);
                }
            }
        }

        this.props.addNewStaticRobotCanvasPanel(sceneIds, showNineScenes, selectedPointsNames);
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
        let gap_x: any[] = [], gap_y: any[] = [];
        plot_data.push({
            x: gap_x,
            y: gap_y,
            id: "gapAll",
            name: "gapAll",
            mode: "lines",
            line: {
                color: 'rgb(242, 243, 174)',
                width: 3,
            }
        });
        let distances: Distances[] = [];
        for(const trace of zoomedUMAPData){
            for(const data of trace){
                for(const [prevPoint, distance] of data.prevPoint()){
                    if(distance.distanceIn2D() > min_dis_2D){
                        distances.push(distance);
                    }
                }
            }
        }

        distances.sort((a, b) => b.distanceIn2D() - a.distanceIn2D());

        for(const distance of distances){
            let data = distance.point1(), prevPoint = distance.point2();
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

            gap_x.push(data.pointIn2D()[0]);
            gap_x.push(prevPoint.pointIn2D()[0]);
            gap_x.push(null);
            gap_y.push(data.pointIn2D()[1]);
            gap_y.push(prevPoint.pointIn2D()[1]);
            gap_y.push(null);
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
     * connect two points that are close in their original high dimension
     * but their distance in 2D is greater than min_dis
     * @param min_dis 
     */
    displayStretches(max_dis_HD: number, min_dis_2D: number){
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

        let stretches: number = 0;
        let stretch_x: any[] = [], stretch_y: any[] = [];
        plot_data.push({
            x: stretch_x,
            y: stretch_y,
            id: "stretchAll",
            name: "stretchAll",
            mode: "lines",
            line: {
                color: 'rgb(152, 203, 104)',
                width: 3,
            }
        });

        let distances: Distances[] = [];
        for(const trace of zoomedUMAPData){
            for(const data of trace){
                for(const [neighbor, distance] of data.nneighborsInHD()){
                    if(distance.distanceIn2D() > min_dis_2D && distance.distanceInHD() <= max_dis_HD){
                        distances.push(distance);
                    }
                }
            }
        }

        distances.sort((a, b) => b.distanceIn2D() - a.distanceIn2D());

        for(const distance of distances){
            let data = distance.point1(), neighbor = distance.point2();
            plot_data.push({
                x: [data.pointIn2D()[0], neighbor.pointIn2D()[0]],
                y: [data.pointIn2D()[1], neighbor.pointIn2D()[1]],
                id: "stretch#" + data.id() + "#" + neighbor.id(),
                name: "stretch-" + stretches,
                mode: "lines",
                visible: "legendonly",
                line: {
                    color: 'rgb(255, 82, 27)',
                    width: 3,
                }
            });
            stretches++;

            stretch_x.push(data.pointIn2D()[0]);
            stretch_x.push(neighbor.pointIn2D()[0]);
            stretch_x.push(null);
            stretch_y.push(data.pointIn2D()[1]);
            stretch_y.push(neighbor.pointIn2D()[1]);
            stretch_y.push(null);   
        }
        this.setState({
            plotly_data: plot_data,
        });
    }

    /**
     * remove all the lines that connect the stetches
     */
    removeStretches(){
        const { plotly_data } = this.state;
        let plot_data = [];
        for(let i=0; i<plotly_data.length; i++){
            let data = plotly_data[i];
            let id = data.id as string;
            if(id.startsWith("stretch")) continue;
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
        let fp_x: any[] = [], fp_y: any[] = [];
        plot_data.push({
            x: fp_x,
            y: fp_y,
            id: "false proximityAll",
            name: "false proximityAll",
            mode: "markers",
            line: {
                color: 'rgb(193, 131, 159)',
                width: 3,
            }
        });

        let distances: Distances[] = [];
        for(const trace of zoomedUMAPData){
            for(const data of trace){
                for(const [neighbor, distance] of data.nneighborsIn2D()){
                    if(distance.distanceInHD() > min_dis_HD && distance.distanceIn2D() <= max_dis_2D){
                        distances.push(distance);
                    }
                }
            }
        }

        distances.sort((a, b) => b.distanceInHD() - a.distanceInHD());

        for(const distance of distances){
            let data = distance.point1(), neighbor = distance.point2();
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

            fp_x.push(data.pointIn2D()[0]);
            fp_x.push(neighbor.pointIn2D()[0]);
            fp_x.push(null);
            fp_y.push(data.pointIn2D()[1]);
            fp_y.push(neighbor.pointIn2D()[1]);
            fp_y.push(null);
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
                    // onUpdate={(figure) => {
                    //     this.setState({
                    //         plotly_data: figure.data,
                    //         plotly_layout: figure.layout,
                    //         plotly_frames: figure.frames
                    //     }); 
                    // }}
                    onSelected={(event) => this.onPlotlySelected(event)}
                />
                </div>
            </div>
        );
    }
}
