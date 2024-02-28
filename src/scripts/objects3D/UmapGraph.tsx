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

import { Graph } from "./Graph";
import { UmapPoint } from "./UmapPoint";

export type umap_type = "Parametric" | "Regular";
 
const palettes = ["white", "yellow", "red", "#204BD8", "green",  /*"orange",*/ "brown", "purple", /*"pink"*/];
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
    protected _displayGap: Boolean; // true if display the gaps
    protected _min2DGapDis: number; // the min gap distance in the 2D map
    protected _displayFalseProximity: Boolean; // true if display the false proximity
    protected _minHighDGapDis: number; // the min gap distance in the original high dimension
    protected _randomSeed: number; // the random seed for the UMAP algo
    protected _showAllTraces: Boolean; // true if show all traces, otherwise hide them
    protected _UMAPType: umap_type;
    protected _UMAPPoints: Map<string, UmapPoint>; // map that stores all the umap points
    protected _lossWeight: number; // For Parametric UMAP, global_correlation_loss_weight: Whether to additionally train on correlation of global pairwise relationships (multidimensional scaling)
    protected _backgroundPointsCount: number; // number of the background points
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
        this._backgroundColor = "#171819"; //rgb(23, 24, 25)
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
        this._minHighDGapDis = 1;
        this._showAllTraces = new Boolean(true);
        this._UMAPType = "Parametric";
        this._UMAPPoints = new Map();
        this._lossWeight = 0;
        this._randomSeed = 20;
        this._backgroundPointsCount = 100;
    }

    backgroundPointsCount(): number{
        return this._backgroundPointsCount;
    }

    setBackgroundPointsCount(count: number){
        this._backgroundPointsCount = count;
    }

    lossWeight(): number{
        return this._lossWeight;
    }

    setLossWeight(weight: number) {
        this._lossWeight = weight;
    }

    allUmapPoints():Map<string, UmapPoint>{
        return this._UMAPPoints;
    }

    setUmapPoints(points: Map<string, UmapPoint>){
        this._UMAPPoints = points;
    }

    getUmapPoint(id: string): UmapPoint | undefined{
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


    minHighDGapDis(): number{
        return this._minHighDGapDis;
    }

    setMinHighDGapDis(dis: number) {
        this._minHighDGapDis = dis;
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