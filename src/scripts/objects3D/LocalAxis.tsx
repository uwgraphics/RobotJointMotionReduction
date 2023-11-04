import { Quaternion, Vector3 } from "three";
import { clamp } from "three/src/math/MathUtils";
import { URDFJoint } from "urdf-loader";
import { APP } from "../constants";
import { Id } from "../Id";
import { Robot } from "./Robot";
import { RobotJoint } from "./RobotJoint";
import { RobotLink } from "./RobotLink";
import T from "../true_three";


/**
 * Wrapper around a Robot's joint so that it can tell it's owner Robot when it
 * has been changed.
 */
export class LocalAxis {
    protected _id: Id;
    // protected _object: RobotJoint | RobotLink; // parent Robot object to whom this joint belongs.
    protected _axis: T.Object3D;
    /**
     * @param robot The parent Robot object to whom this joint belongs.
     * @param joint The URDFJoint that is being manipulated.
     */
    constructor(/*object:RobotJoint | RobotLink*/) {
        this._id = new Id();
        // this._object = object;
        this._axis = new T.AxesHelper(0.5);
    }

    id(): Id {
        return this._id;
    }

    axis(): T.Object3D{
        return this._axis;
    }
}