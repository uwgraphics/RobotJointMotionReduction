import { Id } from "../Id";

export class Distances{
    protected _id: string;
    
    protected _point1: UmapPoint; 
    protected _point2: UmapPoint; 
    protected _distanceInHD: number; // the distances in original high dimension
    protected _distanceIn2D: number; // the distances in UMAP 2D plot
    constructor(id: string, point1: UmapPoint, point2: UmapPoint, distanceInHD: number, distanceIn2D: number) {
        this._id = id;
        this._point1 = point1;
        this._point2 = point2;
        this._distanceInHD = distanceInHD;
        this._distanceIn2D = distanceIn2D;
    }

    id(): string {
        return this._id;
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
    protected _id: string;
    protected _time: number; // the time frame of the corresponding robot pose
    protected _robotInfo: string; // the info of the corresponding robot pose in a format of sceneId#robotId
    
    protected _pointInHD: number[]; // the point in the original high dimension
    protected _pointIn2D: number[]; // the point in UMAP 2D plot
    protected _nneighborsInHD: Map<UmapPoint, Distances>; // key: the id of n neighbors in the original high dimension, value: info about the distances
    protected _nneighborsIn2D: Map<UmapPoint, Distances>; // key: the id of n neighbors in UMAP 2D plot, value: info about the distances
    protected _prevPoint: Map<UmapPoint, Distances>; // key: the id of n neighbors in UMAP 2D plot, value: info about the distances
    constructor(id: string, pointInHD: number[], pointIn2D: number[]) {
        this._id = id;
        this._pointInHD = pointInHD;
        this._pointIn2D = pointIn2D;
        this._nneighborsInHD = new Map();
        this._nneighborsIn2D = new Map();
        this._prevPoint = new Map();

        this._time = 0;
        this._robotInfo = "";
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

    id(): string {
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
        let distance: Distances = new Distances(new Id().value(), this, neighbor, distanceHD, distance2D);
        this._nneighborsInHD.set(neighbor, distance);
    }

    nneighborsIn2D(): Map<UmapPoint, Distances>{
        return this._nneighborsIn2D;
    }

    addneighborIn2D(neighbor: UmapPoint, distanceHD: number, distance2D: number){
        if(neighbor.id() === this.id()) return;
        let distance: Distances = new Distances(new Id().value(), this, neighbor, distanceHD, distance2D);
        this._nneighborsIn2D.set(neighbor, distance);
    }

    prevPoint(): Map<UmapPoint, Distances>{
        return this._prevPoint;
    }

    setPrePoint(prevPoint: UmapPoint, distanceHD: number, distance2D: number){
        let distance: Distances = new Distances(new Id().value(), this, prevPoint, distanceHD, distance2D);
        this._prevPoint.set(prevPoint, distance);
    }

    hasPrePoint(): boolean{
        return this._prevPoint.size > 0;
    }
}