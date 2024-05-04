import { Id } from "../Id";
/**
 * class Distances have all information about the distance between two UMAP points
 * This class does not contain id because id is not needed. Note that there could be 
 * n^2 number of Distances object when the UMAP graph is created
 */
export class Distances{
    
    protected _point1: UmapPoint; 
    protected _point2: UmapPoint; 
    protected _distanceInHD: number; // the distances in original high dimension
    protected _distanceIn2D: number; // the distances in UMAP 2D plot
    constructor(point1: UmapPoint, point2: UmapPoint, distanceInHD: number, distanceIn2D: number) {
        this._point1 = point1;
        this._point2 = point2;
        this._distanceInHD = distanceInHD;
        this._distanceIn2D = distanceIn2D;
    }

    point1(): UmapPoint{
        return this._point1;
    }

    point2(): UmapPoint{
        return this._point2;
    }

    distanceInHD(): number{
        return this._distanceInHD;
    }

    distanceIn2D(): number{
        return this._distanceIn2D;
    }
}

/**
 * class UmapPoint has all the information about a point on a UMAP plot
 */

export class UmapPoint {
    static UmapPointCount: number = 0;
    protected _id: number; // the id is a number because string will take up more memory
    protected _time: number; // the time frame of the corresponding robot pose
    protected _robotInfo: string; // the info of the corresponding robot pose in a format of sceneId#robotId
    
    protected _pointInHD: number[]; // the point in the original high dimension
    protected _pointIn2D: number[]; // the point in UMAP 2D plot
    protected _nneighborsInHD: Map<UmapPoint, Distances>; // key: the id of n neighbors in the original high dimension, value: info about the distances
    protected _nneighborsIn2D: Map<UmapPoint, Distances>; // key: the id of n neighbors in UMAP 2D plot, value: info about the distances
    protected _prevPoint: Map<UmapPoint, Distances>; // key: the id of n neighbors in UMAP 2D plot, value: info about the distances
    protected _maxNeighborDistance: number; // the max distance to its neighbors
    protected _speed: number; // the robot joint "speed" of the segement between previous point and this point
    protected _speedRatio: number; // the relative speed with respect to the speed of the entire trace
    constructor(pointInHD: number[], pointIn2D: number[]) {
        this._id = UmapPoint.UmapPointCount++;
        this._pointInHD = pointInHD;
        this._pointIn2D = pointIn2D;
        this._nneighborsInHD = new Map();
        this._nneighborsIn2D = new Map();
        this._prevPoint = new Map();

        this._time = 0;
        this._robotInfo = "";
        this._maxNeighborDistance = 0;
        this._speed = 0;
        this._speedRatio = 0;
    }

    static resetCounter(){
        console.log("reset umap point counter!");
        UmapPoint.UmapPointCount = 0;
    }

    speedRatio(): number{
        return this._speedRatio;
    }

    setSpeedRatio(speedRatio: number){
        this._speedRatio = speedRatio;
    }

    speed(): number{
        return this._speed;
    }

    setSpeed(speed: number){
        this._speed = speed;
    }

    maxNeighborDistance(): number{
        return this._maxNeighborDistance;
    }

    setMaxNeighborDistance(distance: number){
        this._maxNeighborDistance = Math.max(this._maxNeighborDistance, distance);
    }

    time(): number{
        return this._time;
    }

    setTime(time: number){
        this._time = time;
    }

    robotInfo(): string{
        return this._robotInfo;
    }

    setrobotInfo(id: string){
        this._robotInfo = id;
    }

    id(): number {
        return this._id;
    }

    pointInHD(): number[]{
        return this._pointInHD;
    }

    pointIn2D(): number[]{
        return this._pointIn2D;
    }

    nneighborsInHD(): Map<UmapPoint, Distances>{
        return this._nneighborsInHD;
    }

    addneighborInHD(neighbor: UmapPoint, distanceHD: number, distance2D: number){
        if(neighbor.id() === this.id()) return;
        let distance: Distances = new Distances(this, neighbor, distanceHD, distance2D);
        this._nneighborsInHD.set(neighbor, distance);
        this.setMaxNeighborDistance(distance2D);
        this.setMaxNeighborDistance(distanceHD);
    }

    nneighborsIn2D(): Map<UmapPoint, Distances>{
        return this._nneighborsIn2D;
    }

    addneighborIn2D(neighbor: UmapPoint, distanceHD: number, distance2D: number){
        if(neighbor.id() === this.id()) return;
        let distance: Distances = new Distances(this, neighbor, distanceHD, distance2D);
        this._nneighborsIn2D.set(neighbor, distance);
        this.setMaxNeighborDistance(distance2D);
        this.setMaxNeighborDistance(distanceHD);
    }

    prevPoint(): Map<UmapPoint, Distances>{
        return this._prevPoint;
    }

    setPrePoint(prevPoint: UmapPoint, distanceHD: number, distance2D: number){
        let distance: Distances = new Distances(this, prevPoint, distanceHD, distance2D);
        this._prevPoint.set(prevPoint, distance);
    }

    hasPrePoint(): boolean{
        return this._prevPoint.size > 0;
    }
}