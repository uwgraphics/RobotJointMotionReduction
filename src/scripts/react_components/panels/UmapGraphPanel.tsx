import React, { Component, createRef } from "react";
import { Robot } from "../../objects3D/Robot";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { euclideanDistance, generateRandomPoints, newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { DragButton } from "../DragButton";
import { UMAP } from "umap-js";
import { UmapLineGraph } from "../UmapLineGraph";
import { UmapGraph, umap_type } from "../../objects3D/UmapGraph";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import assert from "assert";
import { APP} from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
import { nearestNeighbors } from "../../nneighbors/umap";
import MersenneTwister from 'mersennetwister';
import axios from 'axios';
import { UmapPoint } from "../../objects3D/UmapPoint";
import { Id } from "../../Id";
// import { time } from "console";
//TODO timewarped positions graph
export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    graph: UmapGraph,
    isTimeWarp: boolean,
    getParentDockLayout: () => DockLayout | undefined,
    force_update: boolean,
    setUmapGraphOptionPanelActive: () => void,
    addNewStaticRobotCanvasPanel: (targetSceneIds: string[], showNineScenes: boolean, selectedPointsNames: string[]) => void,
    removeTab: (tabId: string) => void,
}

interface graph_panel_state {
    counter:number,
    prev_times: time_obj, //previous "current times" used for componentDidUpdate
    use_timeWarp: boolean, // whether to use timewarped data instead of raw data
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of names of lines graphed
    line_colors: string[],
    color_map: Map<string, string>, //map line name to color
    currRobots: Map<string, [number[], number[][]]>, // map the eventName to their umap data
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    need_update: boolean // need to update graph data to trigger fillGraphData
    graph_update: boolean // need to update graph->sent to LineGraph components when lines are added or removed, so axis and lines need regeneration
    nNeighbors: number; // the number of neighbors when calculating umap
    minDis: number; // the min distance when calculating umap
    spread: number; // the spread when calculating umap
    randomSeed: number; // the random seed for the UMAP algo
    UMAPType: umap_type;
    lossWeight: number;
    backgroundPointsRatio: number;
    backgroundPointsMax: number;
    backgroundPointsMin: number;
    autoencoder: boolean;
}

export interface time_obj{
    start: number,
    end: number,
    curr: number
}
export class UmapGraphPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;

    // times and values are states at first
    // but the setState function cannot update the state immediately
    protected times: number[][]; // times[i] is the array of times for line i
    protected umapData: UmapPoint[][]; // values[i] is the array of values for line i
    protected backgroundPoints: UmapPoint[]; // the background points

    constructor(props: graph_panel_props) {
        
        super(props);
        this.fillGraphData.bind(this);
        const rsmanager = this.props.robotSceneManager;
        this.state = {
            counter: 0,
            line_names: [], //list of names of lines graphed
            line_ids: [], //list of names of lines graphed
            line_colors: [],
            prev_times: {
                start: rsmanager.currStartTime(),
                end: rsmanager.currEndTime(),
                curr: rsmanager.currTime()
            },
            use_timeWarp: false,
            color_map: new Map<string, string>(),
            currRobots: new Map(),
            panelHeight: 200,
            panelWidth: 300,
            need_update: true,
            graph_update: false,
            nNeighbors: this.props.graph.nNeighbors(),
            minDis: this.props.graph.minDis(),
            spread: this.props.graph.spread(),
            randomSeed: this.props.graph.randomSeed(),
            UMAPType: this.props.graph.UMAPType(),
            lossWeight: this.props.graph.lossWeight(),
            backgroundPointsRatio: this.props.graph.backgroundPointsRatio(),
            backgroundPointsMax: this.props.graph.backgroundPointsMax(),
            backgroundPointsMin: this.props.graph.backgroundPointsMin(),
            autoencoder: this.props.graph.autoencoder().valueOf(),
        };
        this._graphDiv = createRef();
        this.times = [];
        this.umapData = [];
        this.backgroundPoints = [];
    }

    /**
     * Call back function sent to LineGraph to let them know if graph update is needed, 
     * and they can respond after updating to avoid unnecessary updates
     * @param updated 
     * @returns current state of graph_update
     */
    onGraphUpdate(updated:boolean){
        const{graph_update} = this.state;
        if(!updated){
            return graph_update;
        }else{
            this.setState({
                graph_update: false
            });
        }
        
        return false;
    }

    /**
     * Return positions for the articulated joints throughout the entire time frame
     * @param robot 
     * @param robotPart 
     * @param isWarped if true, then generate warped data, if null then raw data
     * @returns 
     */
    getAllArticulatedJointsPositions(robotScene: RobotScene, robot: Robot, isWarped?:boolean):[number[], number[][]]{
        const rsmanager = this.props.robotSceneManager;
        const startTime=rsmanager.startTime();
        const endTime=rsmanager.endTime();
        let timeRange:readonly number[];
        let timewarping = robotScene.timeWarping();
        if(isWarped && timewarping){
            // log(robotScene.timeWarping()?.timeWarp);
            // TODO the time range is incorrect, need to fix frameRange or find a different way to access the time range array after warping
            timeRange = timewarping.timeWarpMap()[1]//RobotScene.frameRange(startTime, endTime, 20, 2000, robotScene.timeWarping()?.timeWarp);
            // log(timeRange)
        }else{
            timeRange = RobotScene.frameRange(startTime, endTime, 20, 2000);
        }
      
        let result: number[][] = [];
        let times: number[] = [];
        let jointDatas = [];
        for(const [,robotPart] of robot.getArticuatedJointMap())
        {
            let data = robotScene.frameDataFor(robot, timeRange, robotPart);
            jointDatas.push(data.jointAngles);
            times = data.times;
        }

        if(jointDatas.length > 0)
        {
            for(let i=0; i<jointDatas[0].length; i++)
            {
                let joints = [];
                for(let j=0; j<jointDatas.length; j++)
                    joints.push(jointDatas[j][i]);
                result.push(joints);
            }
        }
        
        return [times, result];
    }

  

    async sendDataToPython(jointData: number[][]): Promise<UmapPoint[]> {
        // APP.setPopupHelpPage({ page: PopupHelpPage.LoadingStarted, type: "umap" });
        const dataToSend = {
            type: this.props.graph.UMAPType(),
            nneighbors:  this.props.graph.nNeighbors(),
            min_dis: this.props.graph.minDis(),
            spread: this.props.graph.spread(),
            random_seed: this.props.graph.randomSeed(),
            data: jointData,
            loss_weight: this.props.graph.lossWeight(),
            autoencoder: this.props.graph.autoencoder().valueOf(),
        };
        let umapData: UmapPoint[] = [];
        try {
            /**
             * This part may need to change if the server is deployed
             */
            const response = await axios.post('http://localhost:5000/api/data', dataToSend);
            // console.log(response.data);
            UmapPoint.resetCounter();
            for(let i=0; i<jointData.length; i++){
                let umapPoint: UmapPoint = new UmapPoint(jointData[i], response.data.UMAPData[i]);
                umapData.push(umapPoint);
            }

            // store neighbors information
            for(let i=0; i<jointData.length; i++){
                let umapPoint = umapData[i];
                let nneighbors_HD_indices = response.data.nneighbors_HD[i];
                let nneighbors_2D_indices = response.data.nneighbors_2D[i];
                let nneighbors_HD_dis = response.data.nneighbors_HD_dis[i];
                let nneighbors_2D_dis = response.data.nneighbors_2D_dis[i];
                for(const [j, index] of nneighbors_HD_indices.entries()){
                    let neighbor = umapData[index];
                    let distance_2D = euclideanDistance(umapPoint.pointIn2D(), neighbor.pointIn2D());
                    umapPoint.addneighborInHD(neighbor, nneighbors_HD_dis[j], distance_2D);
                }
                    
                for(const [j, index] of nneighbors_2D_indices.entries()){
                    let neighbor = umapData[index];
                    let distance_HD = euclideanDistance(umapPoint.pointInHD(), neighbor.pointInHD());
                    umapPoint.addneighborIn2D(neighbor, distance_HD, nneighbors_2D_dis[j]);
                }
            }
        } catch (error) {
            console.error('Error sending data to Python:', error);
        }
        return umapData;
    };

    /**
     * given the eventName (line id), generate the line names that will be shown in the legend
     * @param eventName 
     * @returns 
     */
    generateLineName(eventName: string)
    {
        const[sceneId, robotName] = this.decomposeId(eventName);
        const {robotSceneManager} = this.props;
        let scene = robotSceneManager.robotSceneById(sceneId);
        return scene?.name() + "_" + robotName;
    }

    /**
     * compare two joint data vectors
     * @param d1 
     * @param d2 
     * @returns true if two data arrays are the same
     */
    compareJointData(d1: number[], d2: number[]): boolean
    {
        if(d1.length !== d2.length) return false;
        for(let i=0; i<d1.length; i++)
            // if(d1[i] !== d2[i]) return false;
            if (Math.abs(d1[i] - d2[i]) > 0.0001) return false;
        return true;
    }
    
    /**
     * filter the joint data, eleminate duplicates
     * @param jointData 
     * @returns 
     */
    filterJointData(jointData: number[][], times: number[] ): [number[][], number[]]
    {
        let resultJointData: number[][] = [];
        let resultTimes: number[] = [];
        for(let i=0; i<jointData.length; i++)
        {
            if(i === 0 || !this.compareJointData(jointData[i-1], jointData[i]))
            {
                resultJointData.push(jointData[i]);
                resultTimes.push(times[i]);
            }
        }

        function shuffleArray<T>(array: T[]): T[] {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }
        // resultJointData = shuffleArray(resultJointData);
        return [resultJointData, resultTimes];
    }

    /**
     * fill graph data
     */
    async fillGraphData(): Promise<void>
    {
        APP.setPopupHelpPage({ page: PopupHelpPage.LoadingStarted, type: "umap" });
        const { currRobots, color_map } = this.state;
        let line_names = [], line_ids = [], line_colors = [];
        let _times = [];
        let umapData = [];
        let filteredJointData: number[][] = [];
        let filteredTimes: number[][] = [];
        let lengths: number[] = []; // the length of data array for each robot after filtering
        for (const [eventName, [times, jointData]] of currRobots) {
            // console.log(jointData)
            console.log(jointData)
            let [filteredData, filteredTime] = this.filterJointData(jointData, times);
            filteredJointData = filteredJointData.concat(filteredData);
            // filteredJointData = filteredJointData.concat(jointData);
            filteredTimes.push(filteredTime);
            // assert (filteredData.length === filteredTime.length);
            lengths.push(filteredData.length);
        }
        if (filteredJointData.length !== 0) {
            let backgroundPointsCount = Math.floor(filteredJointData.length * this.props.graph.backgroundPointsRatio());
            let backgroundPoints = generateRandomPoints(backgroundPointsCount, filteredJointData[0].length, 
            this.props.graph.backgroundPointsMax(), this.props.graph.backgroundPointsMin());
            filteredJointData = filteredJointData.concat(backgroundPoints);
            // console.log(backgroundPoints)
            let embedding = await this.sendDataToPython(filteredJointData);

            // console.log(embedding)

            let index: number = 0;
            let robotIndex: number = 0;
            for (const [eventName, [times, jointData]] of currRobots) {
                line_names.push(this.generateLineName(eventName));
                line_ids.push(eventName);
                line_colors.push(color_map.get(eventName)!);
                let currUmap = embedding.slice(index, index + lengths[robotIndex]);

                let j = 0;
                let filterdUmapData: UmapPoint[] = [];
                /**
                 * restore data because the original data is filterd
                 * simply assign the value of previous point to this point
                 * This is done by comparing filterdTimes array and times array
                 * i.e. if filteredTimes = [0, 2, 3] and times = [0, 1, 2, 3]
                 * it means point at time 1 should be the same as the point at time 0
                 */
                for (let i = 0; i < times.length; i++) {
                    if (j+1 < filteredTimes[robotIndex].length && times[i] >= filteredTimes[robotIndex][j+1]) {
                        j++;
                    }
                    currUmap[j].setTime(times[i]);
                    currUmap[j].setrobotInfo(eventName);
                    filterdUmapData.push(currUmap[j]);
                    // currUmap[i].setTime(times[i]);
                    // currUmap[i].setrobotInfo(eventName);
                    // filterdUmapData.push(currUmap[i]);
                    if(i > 0){
                        // store previous point information
                        let prevPoint = filterdUmapData[i-1];
                        let distance_HD = euclideanDistance(filterdUmapData[i].pointInHD(), prevPoint.pointInHD());
                        let distance_2D = euclideanDistance(filterdUmapData[i].pointIn2D(), prevPoint.pointIn2D());
                        filterdUmapData[i].setPrePoint(prevPoint, distance_HD, distance_2D);
                        let time_diff = filterdUmapData[i].time() - prevPoint.time();
                        if(time_diff !== 0)
                            filterdUmapData[i].setSpeed(distance_HD / time_diff);
                    }
                }
                
                _times.push(times);
                umapData.push(filterdUmapData);

                index = index + lengths[robotIndex];
                robotIndex++;
            }

            // calculte the relative speed
            let max_speed = 0, min_speed = Number.MAX_VALUE;
            for(const trace of umapData){
                for (let i = 1; i < trace.length; i++) {
                    let speed = trace[i].speed();
                    if (speed < min_speed) min_speed = speed;
                    if (speed > max_speed) max_speed = speed;
                }
            }
            if (max_speed > min_speed) {
                for(const trace of umapData){
                    for (let i = 1; i < trace.length; i++) {
                        let speed = trace[i].speed();
                        let ratio = (speed - min_speed) / (max_speed - min_speed);
                        ratio = 0.2 + ratio * 0.6 // set the ratio to be in [0.2, 0.8]
                        trace[i].setSpeedRatio(ratio);
                    }
                }
            }
            
            for(let i=index; i<embedding.length; i++){
                this.backgroundPoints.push(embedding[i]);
            }
        }

        let UmapPointsMap: Map<number, UmapPoint> = new Map();
        for(const trace of umapData){
            for(const point of trace){
                UmapPointsMap.set(point.id(), point);
            }
        }
        console.log(umapData)
        this.props.graph.setUmapPoints(UmapPointsMap);
        this.times = _times;
        this.umapData = umapData;
        this.props.graph.setLineNames(line_names);
        this.props.graph.setLineIds(line_ids);
        this.props.graph.setLineColors(line_colors);
        this.setState({
            line_names: line_names,
            line_colors: line_colors,
            line_ids: line_ids,
            need_update: false,
        })
        APP.setPopupHelpPage({ page: PopupHelpPage.LoadingSuccess, type: "umap"});
    }

    componentWillUnmount() {
        if (this._panel_resize_observer) {
          this._panel_resize_observer.disconnect();
        }
    }
    componentDidMount(): void {
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._graphDiv.current?.classList.add('selected');
        this._panel_resize_observer = new ResizeObserver((entries)=>{
            // console.log(entries[0].contentRect);
            this.setState({
                panelWidth: (entries[0].contentRect.width),
                panelHeight: (entries[0].contentRect.height) * 0.9,
            });
        });
        if(this._graphDiv && this._graphDiv.current){
            this._panel_resize_observer.observe(this._graphDiv.current);
        }

        // draw lines based on the initial graph contents
        // this is mainly used to restore the graph contents
        const {graph} = this.props;
        let eventNames: string[] = [];
        for(const line_id of graph.lineIds())
        {
            const [sceneId, robotName] = this.decomposeId(line_id);
            let eventName = sceneId + "#" + robotName;
            eventNames.push(eventName);
        }
        this.changeLines(eventNames, true);
    }
    componentDidUpdate(prevProps:graph_panel_props) {
        let line = this.props.graph.deleteLine();
        if(line !== undefined)
        {
            if(this.state.currRobots.has(line))
            {
                this.state.currRobots.delete(line); // remove the object from the graph tab
                this.changeLines([line], false);
                this.props.graph.setDeleteLine(undefined, undefined);
            }
        }

        if(this.props.graph.nNeighbors() !== this.state.nNeighbors 
        || this.props.graph.minDis() !== this.state.minDis 
        || this.props.graph.spread() !== this.state.spread
        || this.props.graph.randomSeed() !== this.state.randomSeed
        || this.props.graph.UMAPType() !== this.state.UMAPType
        || this.props.graph.lossWeight() !== this.state.lossWeight
        || this.props.graph.backgroundPointsRatio() !== this.state.backgroundPointsRatio
        || this.props.graph.backgroundPointsMax() !== this.state.backgroundPointsMax
        || this.props.graph.backgroundPointsMin() !== this.state.backgroundPointsMin
        || this.props.graph.autoencoder().valueOf() !== this.state.autoencoder){
            this.setState({
                nNeighbors: this.props.graph.nNeighbors(),
                minDis: this.props.graph.minDis(),
                spread: this.props.graph.spread(),
                randomSeed: this.props.graph.randomSeed(),
                UMAPType: this.props.graph.UMAPType(),
                lossWeight: this.props.graph.lossWeight(),
                backgroundPointsRatio: this.props.graph.backgroundPointsRatio(),
                backgroundPointsMax: this.props.graph.backgroundPointsMax(),
                backgroundPointsMin: this.props.graph.backgroundPointsMin(),
                autoencoder: this.props.graph.autoencoder().valueOf(),
            });
            // this.props.graph.resetColor();
            this.fillGraphData();
        }

        const {prev_times, need_update} = this.state;
        const timeBoundChange = (prev_times.start !== this.props.robotSceneManager.currStartTime() || 
            prev_times.end !== this.props.robotSceneManager.currEndTime());
        // log("in component did update, currEndTime is " + this.props.robotSceneManager.currEndTime());
        const currTimeChange = prev_times.curr !== this.props.robotSceneManager.currTime();

        if(timeBoundChange || currTimeChange)
        {
            this.setState({
                prev_times: {
                    start: this.props.robotSceneManager.currStartTime(),
                    end: this.props.robotSceneManager.currEndTime(),
                    curr: this.props.robotSceneManager.currTime()
                },
            })
        }

        // if(currTimeChange ||
        //     // refresh ||
        //     // clear ||
        //     need_update
        //     ) {
        //     // log("Updating states in componentDidUpdate");
        //     this.fillGraphData();
        // }

        // Note: force_update updates all the graphs, not just selected one
        const{force_update} = this.props;
        const force_updateChnage = force_update !== prevProps.force_update;
        if (force_updateChnage)
            this.setState({
                need_update: true
            });
    }

    dataSize(): number{
        const { currRobots} = this.state;
        let size = 0;
        for (const [eventName, [times, jointData]] of currRobots) {
            let [filteredData, filteredTime] = this.filterJointData(jointData, times);
            size += filteredData.length;
        }
        return size;
    }

    /**
     * handle the change of lines
     * @param eventName // the line id
     * @param add true if add a line, false if delete a line
     * @returns 
     */
    changeLines(eventNames: string[], add: boolean)
    {
        for (const eventName of eventNames) {
            if (this.state.currRobots.has(eventName)) continue;
            const [sceneId, robotName] = this.decomposeId(eventName);
            const { robotSceneManager } = this.props;
            let scene = robotSceneManager.robotSceneById(sceneId);
            if (scene === undefined) continue;
            if (!robotSceneManager.isActiveRobotScene(scene))
                robotSceneManager.activateRobotScene(scene);
            let robot = scene.getRobotByName(robotName);
            if (robot === undefined) continue;
            if (add) {
                let [times, jointData] = this.getAllArticulatedJointsPositions(scene, robot);
                this.state.currRobots.set(eventName, [times, jointData]);
                this.state.color_map.set(eventName, this.props.graph.getColor());
            }
            else {
                this.state.currRobots.delete(eventName);
                this.state.color_map.delete(eventName);
            }
        }  

        // set the default nneighbor to be 10% of the data
        // but users are still able to change the nneighbor
        let nneighbor_default = Math.floor(this.dataSize() * 0.1);
        this.props.graph.setNNeighbors(nneighbor_default);
        this.setState({
            nNeighbors: nneighbor_default,
        });
        this.fillGraphData();
    }

    /**
     * enable the button to be dragged over the panel
     * @param event 
     */
    dragOverHandler(event: any) {
        event.preventDefault();
    }
    
    /**
     * handle the drop of a button
     * store the information of the button in currObjects
     * the info has a format like scene_id#robot_name&robotpart_name
     * @param event 
     * @returns 
     */
    dropHandler(event: any) {
        event.preventDefault();
        const windowElement = event.target;
        let eventName = event.dataTransfer.getData("text/plain");
    
        this.changeLines([eventName], true);
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
    /**
     * handle the click of the Difference Graph Panel
     * update the id of currently selected panel
     */
    clickHandler = () => {
        // console.log(`Clicked on GraphPanel. the key is ` + this.props.graphKey);
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._graphDiv.current?.classList.add('selected');
        
        // console.log(`Clicked on GraphPanel. the key is ` + this.props.graphKey);
        this.props.robotSceneManager.setCurrUmapGraph(this.props.graph.id());
        this.props.setUmapGraphOptionPanelActive();
    };
    /**
     * decompose the id of the drag button
     * to sceneId, robotName, partName
     * @param eventName
     * @returns 
     */
    decomposeDragButtonId(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName];
    }

    // check if time has changed in render manually
    render() {
        const {line_names, line_ids, line_colors,
           use_timeWarp,color_map, prev_times,
            panelHeight, panelWidth,} = this.state;
        const isTimeWarp = this.props.isTimeWarp;
        return (
          <div className={"GraphPanel"} ref={this._graphDiv} 
          onDrop={this.dropHandler.bind(this)}
          onDragOver={this.dragOverHandler.bind(this)}
          onClick={this.clickHandler.bind(this)}
          style={{backgroundColor: this.props.graph.backgroundColor()}}>
            <UmapLineGraph
              robotSceneManager={this.props.robotSceneManager}
              graph={this.props.graph}
              times={this.times}
              umapData={this.umapData}
              startTime={prev_times.start}
              endTime={prev_times.end}
              currTime={prev_times.curr}
              isTimeWarp={false}
              line_names={line_names}
              line_colors={line_colors}
              width={panelWidth}
              height={panelHeight}
              line_ids={line_ids}
              selected={this.props.robotSceneManager.getCurrUmapGraph() === this.props.graph}
              lineWidth={this.props.graph.lineWidth()}
              axisColor={this.props.graph.axisColor()}
              showLines={this.props.graph.showLines()}
              displayGap={this.props.graph.displayGap()}
              min2DGapDis={this.props.graph.min2DGapDis()}
              displayStretch={this.props.graph.displayStretch()}
              min2DStretchDis={this.props.graph.min2DStretchDis()}
              displayFolds={this.props.graph.displayFolds()}
              minHDFoldDis={this.props.graph.minHDFoldDis()}
              max2DFoldDis={this.props.graph.max2DFoldDis()}
              showAllTraces={this.props.graph.showAllTraces()}
              backgroundPoints={this.backgroundPoints}
              neighborDistance={this.props.graph.neighborDistance()}
              displayNeighbors={this.props.graph.displayNeighbors()}
              displayPointsInRegion={this.props.graph.displayPointsInRegion()}
              displaySpeed={this.props.graph.displaySpeed()}
              onGraphUpdate={this.onGraphUpdate.bind(this)}
              addNewStaticRobotCanvasPanel={this.props.addNewStaticRobotCanvasPanel}
              removeTab={this.props.removeTab}
            />
          </div>
        );
    }
}