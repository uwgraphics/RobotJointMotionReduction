/**
 * class UmapGraph has similar functionalities as the RobotScene class. 
 * It is a bond between one graph panel and its corresponding legend panel.
 * A graph panel and its corresponding legend panel have a unique Graph object, 
 * through which two panels can "communicate with each other" such as adding or 
 * deleting a line.
 * 
 * The graph panel and legend panel are not parent-children relation. Instead, they
 * are siblings in React.js (They are both children of RobotWorkspace). The legend 
 * panel cannot access the state in the graph panel. This is the main reason why 
 * the Graph class is created.
 */

import { RobotSceneManager } from "../RobotSceneManager";
import { Graph } from "./Graph";
import { Robot } from "./Robot";
import { RobotJoint } from "./RobotJoint";
import { UmapPoint } from "./UmapPoint";

export type umap_type = "Parametric" | "Regular";
 
// const palettes = ["white", "yellow", "red", "#204BD8", "green",  /*"orange",*/ "brown", "purple", /*"pink"*/];
const palettes = ['#17becf', '#bcbd22', '#7f7f7f', '#e377c2', '#8c564b', '#9467bd', '#d62728', '#2ca02c', '#ff7f0e', '#1f77b4'];
export class UmapGraph {
    static counter: number = 0;
    protected _id: string;
    protected _name: string;
    protected _line_names: string[];
    protected _line_ids: string[];
    protected _line_colors: string[];
    protected _colorPalettes: string[]; // the colors of the traces
    protected _delete_line?: string;
    protected _lineWidth: number; // the stoke size of the curves displayed in the graph
    protected _backgroundColor: string; // the background color of the graph
    protected _axisColor: string; // the axis color of the graph
    protected _nNeighbors: number; // the number of neighbors when calculating umap
    protected _minDis: number; // the min distance when calculating umap
    protected _spread: number; // the spread when calculating umap
    protected _showLines: Boolean; // true if show lines, otherwise only show dots
    protected _nneighborMode: Boolean; // true if show nneighbors before the reduction, otherwise show nneighbors after reduction
    protected _showNineScenes: Boolean; // true if show nine scenes in one window
    protected _displayGap: Boolean; // true if display the gaps (adjacent points mapped to different places)
    protected _min2DGapDis: number; // the min gap distance in the 2D map
    protected _displayStretch: Boolean; // true if display the stetches (similar motion mapped to different places)
    protected _min2DStretchDis: number; // the min stetch distance in the 2D map
    protected _displayFalseProximity: Boolean; // true if display the false proximity
    protected _minHDFoldDis: number; // the min folds distance in the original high dimension
    protected _max2DFoldDis: number; // the max folds distance in the 2D graph
    protected _randomSeed: number; // the random seed for the UMAP algo
    protected _showAllTraces: Boolean; // true if show all traces, otherwise hide them
    protected _UMAPType: umap_type;
    protected _UMAPPoints: Map<number, UmapPoint>; // map that stores all the umap points
    protected _backgroundPointsRatio: number; // the ratio of the background points to the total robot joint points
    protected _backgroundPointsMax: number; // the max of the background points
    protected _backgroundPointsMin: number; // the min of the background points
    protected _currentClickedPoint: UmapPoint | undefined; // the point that is most recently clicked on 
    protected _maxNeighborDistance: number;
    protected _neighborDistance: number;
    protected _displayNeighbors: Boolean; // false if clear all neighbors
    protected _robotSceneManager: RobotSceneManager | undefined;
    protected _selectedRobotPartName: string;
    protected _displayPointsInRegion: Boolean; // false if clear all points in selected region
    protected _displaySpeed: Boolean; // true if display the colored speed traces

    //unique to parametric UMAP
    protected _lossWeight: number; // For Parametric UMAP, global_correlation_loss_weight: Whether to additionally train on correlation of global pairwise relationships (multidimensional scaling)
    protected _autoencoder: Boolean; // whether to enable autoencoder of the parametric UMAP
    /**
     * 
     * @param id
     * @param isDiff 
     * @param isTimeWarp 
     * @param line_names 
     * @param line_ids 
     * @param line_colors 
     * @param delete_line the line id of the current deleted line (the user clicks the "X" in legend panel)
     */
    constructor(id: string, line_names?: string[], line_ids?: string[], line_colors?: string[], 
        delete_line?: string, lineWidth?: number, backgroundColor?:string, axisColor?:string) {
        this._id = id;
        this._line_colors = [];
        this._line_names = [];
        this._line_ids = [];
        if(line_colors !== undefined)
            this._line_colors = line_colors;
        if(line_names != undefined)
            this._line_names = line_names;
        if(line_ids != undefined)
            this._line_ids = line_ids;
        this._name = "Umap Graph" + UmapGraph.counter;
        this._delete_line = delete_line;

        this._lineWidth = 1;
        this._backgroundColor = "white"; //rgb(23, 24, 25)
        // this._backgroundColor = "#171819"; //rgb(23, 24, 25)
        this._axisColor = "#B7B7BD"; // rgb(183, 183, 189)
        if(backgroundColor !== undefined)
            this._backgroundColor = backgroundColor;
        if(axisColor !== undefined)
            this._axisColor = axisColor;
        if(lineWidth !== undefined)
            this._lineWidth = lineWidth;

        this._colorPalettes = [...palettes];
        UmapGraph.counter++;

        this._nNeighbors = 30;
        this._minDis = 0.1;
        this._spread = 0.1;
        this._showLines = new Boolean(true);
        this._nneighborMode = new Boolean(true);
        this._showNineScenes = new Boolean(true);
        this._displayGap = new Boolean(false);
        this._min2DGapDis = 1;
        this._displayFalseProximity = new Boolean(false);
        this._minHDFoldDis = 1;
        this._max2DFoldDis = 0.01;
        this._displayStretch = new Boolean(false);
        this._min2DStretchDis = 1;
        this._showAllTraces = new Boolean(true);
        this._UMAPType = "Parametric";
        this._UMAPPoints = new Map();
        this._lossWeight = 0;
        this._randomSeed = 20;
        this._backgroundPointsRatio = 0;
        this._backgroundPointsMax = 2 * Math.PI;
        this._backgroundPointsMin = -2 * Math.PI;
        this._autoencoder = new Boolean(false);
        this._displaySpeed = new Boolean(false);
        this._maxNeighborDistance = 10;
        this._neighborDistance = 5;
        this._displayNeighbors = true;
        this._displayPointsInRegion = true;

        this._selectedRobotPartName =  "";
    }

    displaySpeed(): Boolean {
        return this._displaySpeed;
    }

    toggleDisplaySpeed(){
        this._displaySpeed = new Boolean(!this._displaySpeed.valueOf());
    }


    setRobotSceneManager(robotSceneManager: RobotSceneManager){
        this._robotSceneManager = robotSceneManager;
    }

    setSelectedRobotPartName(name: string){
        this._selectedRobotPartName = name;
    }

    selectedRobotPartName(): string{
        return this._selectedRobotPartName;
    }

    currRobot(): Robot | undefined {
        if(this._robotSceneManager === undefined) return;
        for(const [, point] of this._UMAPPoints){
            const [sceneId, robotName] = point.robotInfo().split("#");
            let scene = this._robotSceneManager.robotSceneById(sceneId);
            if (scene === undefined) return;
            if (!this._robotSceneManager.isActiveRobotScene(scene))
                this._robotSceneManager.activateRobotScene(scene);
            let robot = scene.getRobotByName(robotName);
            return robot;
        }
    }

    displayNeighbors(): Boolean {
        return this._displayNeighbors;
    }

    toggleDisplayNeighbors(){
        this._displayNeighbors = new Boolean(!this._displayNeighbors.valueOf());
    }

    displayPointsInRegion(): Boolean {
        return this._displayPointsInRegion;
    }

    toggleDisplayPointsInRegion(){
        this._displayPointsInRegion = new Boolean(!this._displayPointsInRegion.valueOf());
    }

    neighborDistance(): number{
        return this._neighborDistance;
    }

    setNeighborDistance(distance: number){
        this._neighborDistance = distance;
    }

    maxNeighborDistance(): number{
        return this._maxNeighborDistance;
    }

    setMaxNeighborDistance(distance: number){
        this._maxNeighborDistance = distance;
       // this._neighborDistance = Math.min(this._neighborDistance, this._maxNeighborDistance);
    }

    currentClickedPoint(): UmapPoint | undefined{
        return this._currentClickedPoint;
    }

    setCurrentClickedPoint(point: UmapPoint){
        this._currentClickedPoint = point;
    }

    autoencoder(): Boolean{
        return this._autoencoder;
    }

    toggleAutoencoder() {
        this._autoencoder = new Boolean(!this._autoencoder.valueOf());
    }

    backgroundPointsMin(): number{
        return this._backgroundPointsMin;
    }

    setBackgroundPointMin(min: number){
        this._backgroundPointsMin = min;
    }

    backgroundPointsMax(): number{
        return this._backgroundPointsMax;
    }

    setBackgroundPointMax(max: number){
        this._backgroundPointsMax = max;
    }

    backgroundPointsRatio(): number{
        return this._backgroundPointsRatio;
    }

    setBackgroundPointsRatio(ratio: number){
        this._backgroundPointsRatio = ratio;
    }

    lossWeight(): number{
        return this._lossWeight;
    }

    setLossWeight(weight: number) {
        this._lossWeight = weight;
    }

    allUmapPoints():Map<number, UmapPoint>{
        return this._UMAPPoints;
    }

    setUmapPoints(points: Map<number, UmapPoint>){
        this._UMAPPoints = points;
    }

    getUmapPoint(id: number): UmapPoint | undefined{
        return this._UMAPPoints.get(id);
    }

    UMAPType(): umap_type{
        return this._UMAPType;
    }

    setUMAPType(type: umap_type){
        this._UMAPType = type;
    }

    showAllTraces(): Boolean{
        return this._showAllTraces;
    }

    toggleShowAllTraces(){
        this._showAllTraces = new Boolean(!this._showAllTraces.valueOf());
    }

    randomSeed(): number{
        return this._randomSeed;
    }

    setRamdomSeed(randomSeed: number){
        this._randomSeed = randomSeed;
    }


    minHDFoldDis(): number{
        return this._minHDFoldDis;
    }

    setMinHDFoldDis(dis: number) {
        this._minHDFoldDis = dis;
    }

    max2DFoldDis(): number{
        return this._max2DFoldDis;
    }

    setMax2DFoldDis(dis: number) {
        this._max2DFoldDis = dis;
    }

    displayFalseProximity(): Boolean{
        return this._displayFalseProximity;
    }

    toggleDisplayFalseProximity(){
        this._displayFalseProximity = new Boolean(!this._displayFalseProximity.valueOf());
    }

    min2DGapDis(): number{
        return this._min2DGapDis;
    }

    setMin2DGapDis(dis: number) {
        this._min2DGapDis = dis;
    }

    displayGap(): Boolean{
        return this._displayGap;
    }

    toggleDisplayGap(){
        this._displayGap = new Boolean(!this._displayGap.valueOf());
    }

    min2DStretchDis(): number{
        return this._min2DStretchDis;
    }

    setMin2DStretchDis(dis: number) {
        this._min2DStretchDis = dis;
    }

    displayStretch(): Boolean{
        return this._displayStretch;
    }

    toggleDisplayStretch(){
        this._displayStretch = new Boolean(!this._displayStretch.valueOf());
    }

    showNineScenes(): Boolean{
        return this._showNineScenes;
    }

    toggleShowNineScenes(){
        this._showNineScenes = new Boolean(!this._showNineScenes.valueOf());
    }

    showLines(): Boolean{
        return this._showLines;
    }

    toggleShowLines(){
        this._showLines = new Boolean(!this._showLines.valueOf());
    }

    nneighborMode(): Boolean{
        return this._nneighborMode;
    }

    togglenneighborMode(){
        this._nneighborMode = new Boolean(!this._nneighborMode.valueOf());
    }

    nNeighbors(): number{
        return this._nNeighbors;
    }

    setNNeighbors(nNeighbors: number) {
        this._nNeighbors = nNeighbors;
    }

    minDis(): number{
        return this._minDis;
    }

    setMinDis(minDis: number) {
        this._minDis = minDis;
    }

    spread(): number{
        return this._spread;
    }

    setSpread(spread: number) {
        this._spread = spread;
    }

    backgroundColor(): string{
        return this._backgroundColor;
    }

    setBackgroundColor(color: string){
        this._backgroundColor = color;
    }

    axisColor(): string{
        return this._axisColor;
    }

    setAxisColor(color: string){
        this._axisColor = color;
    }

    setLineWidth(lineWidth: number){
        this._lineWidth = lineWidth;
    }

    lineWidth(): number{
        return this._lineWidth;
    }

    setDeleteLine(line: string|undefined, line_color: string | undefined){
        this._delete_line = line;
        if(line_color !== undefined)
            this.addColorBack(line_color);
    }

    deleteLine(): string | undefined{
        return this._delete_line;
    }

    getColor(): string
    {
        let color =  this._colorPalettes.pop();
        return (color === undefined) ? Graph.genRandColor() : color;
    }

    addColorBack(color: string)
    {
        if(palettes.indexOf(color) === -1)
            return;
        this._colorPalettes.push(color);
    }

    resetColor()
    {
        this._colorPalettes = [...palettes];
    }
    
    name(): string{
        return this._name;
    }

    setName(graphName: string){
        this._name = graphName;
    }
    
    id(): string {
        return this._id;
    }
    
    setLineNames(line_names: string[]) {
        this._line_names = line_names;
    }

    lineNames(): string[]{
        return this._line_names;
    }

    setLineIds(line_ids: string[]) {
        this._line_ids = line_ids;
    }

    lineIds(): string[]{
        return this._line_ids;
    }

    setLineColors(line_colors: string[]){
        this._line_colors = line_colors;
    }

    lineColors(): string[]{
        return this._line_colors;
    }
}