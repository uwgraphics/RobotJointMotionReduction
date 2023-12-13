import { Animation } from '../Animation';
import { AnimationGroup } from '../AnimationGroup';
import { AnimationManager, serialized_animation_manager } from '../AnimationManager';
import { AnimationTable, animation_frame, serialized_animation_table } from '../AnimationTable';
import { APP, MAX_FRAMERATE } from '../constants';
import { enumerate, randColor, clamp, countUsing, onlyUniquesUsing as onlyUniquesBy, zip } from '../helpers';
import { Id } from '../Id';
import { loadJsonFromLocalFile, loadJsonFromURL } from '../load_functions';
import { Robot, serialized_robot } from '../objects3D/Robot';
import { RobotJoint } from '../objects3D/RobotJoint';
import { RobotLink } from '../objects3D/RobotLink';
import { RobotSceneManager } from '../RobotSceneManager';
import { saveToJson } from '../save_functions';
import { Trace } from '../objects3D/Trace';
import { serialized_three_scene, ThreeScene } from "./ThreeScene";
import assert, { AssertionError } from 'assert';
import T from '../true_three';
import { MaybeDestroyed } from '../maybe_destroyed/MaybeDestroyed';
import { MaybeDestroyedArray } from '../maybe_destroyed/MaybeDestroyedArray';
import { SubscribeArrayWithArg } from '../subscriptable/SubscribeArrayWithArg';
import { SubscriptableValue } from '../subscriptable/SubscriptableValue';
import { DynamicTimeWarp } from '../DynamicTimeWarping';
import { Arrow } from '../objects3D/Arrow';
import { QuaternionTrace } from '../objects3D/QuaternionTrace';
import { RobotScene } from './RobotScene';

export type TimeWarpFunc = (baseTime: number) => number;

export interface camera_info {
    lookFrom: T.Vector3;
    lookAt:   T.Vector3;
}

export interface serialized_robot_scene extends serialized_three_scene {
    id: string,
    robots: serialized_robot[],
    animationManager: serialized_animation_manager,
    animationTables: serialized_animation_table[],
}

export interface old_serialized_robot_scene {
    animationMap: number[],
    animationURLs: string[],
    bookmarks: {
        robotName: string,
        bookmarks: {
            name: string,
            bookmarks?: [],
            cameraMarks?: [],
        }[],
    }[],
    cameraViews: [],
    configs: number[],
    configsMap: number[],
    generalSettings: {
        camera: {
            cameraPos: {
                x:number,
                y:number,
                z:number,
            },
            cameraLookAt: {
                x:number,
                y:number,
                z:number,
            },
            cameraZoom: number,
        },
        clickSelect: boolean,
        selectedRobot: string,
        tabStates: {
            top: boolean,
            bottom: boolean,
            left: boolean,
            right: boolean,
        }
    },
    linesData: [],
    robotFiles: string[], // URLs to robots
    robotSettings: [boolean, boolean, string, boolean, string][],
    viewOnly: boolean,
}

export interface joint_configs {

}

export type RobotFrameData = {
    times: number[],
    positions: Map<undefined | RobotJoint | RobotLink, T.Vector3[]>,
    jointAngles: Map<RobotJoint, number[]>
    rotations: Map<undefined | RobotJoint | RobotLink, T.Quaternion[]>,
}

export type FrameData = Map<Robot, RobotFrameData>;

/**
 * An object capable of warping time from a base scene to a target scene i.e.
 * each time in the base scene's time scale is mapped to a time in the target
 * scene's time scale. The mapping may be 1:1, linear, or some other function.
 * 
 * WARNING: while `untimeWarp` is meant to simply be the opposite of `timeWarp`,
 * they may both return approximations. This means that calling them successively
 * to timeWarp and then untimeWarp a value over and over again may walk the value
 * in a direction i.e. make it successively more negative and/or positive rather
 * than keeping it around some consistent value.
 */
export interface TimeWarpObj {
    /**
     * @returns The given time in the base RobotScene's time scale converted to
     * the corresponding time in the target RobotScene's time scale.
     */
    timeWarp(baseTime: number): number;
    /**
     * @returns The given time in the target RobotScene's time scale converted
     * to the corresponding time in the base RobotScene's time scale.
     */
    untimeWarp(targetTime: number): number;
    /**
     * @returns A pair of parrallel arrays used to map times in the base scene
     * to times in the target scene (i.e. returns [baseSceneTimes,
     * targetSceneTimes]). Retruns undefined if the data is kept in a different
     * format.
     */
    timeWarpMap(): readonly [readonly number[], readonly number[]];

    indexMap(): [ReadonlyArray<number>, ReadonlyArray<number>];
}
const palettes = ["rgb(255, 255, 0)", "brown", /*"white",*/ "red", "#204BD8", "purple", "green"];
var numScenes:number = 0;

/**
 * An encapsulation of a ThreeScene that specifically should be used for holding
 * the traces in quaternion space
 */
export class StaticRobotScene extends ThreeScene {
    protected _id: Id;
    protected _name: string;
    protected _robots: Map<String, Robot>;    // Robot object (misnomer as any object loaded from a URDF can be put into a Robot object)

    // Traces that are owned by this scene.
    protected _traces: QuaternionTrace[];

    protected _color: string;

    protected _colorPalettes: string[]; // the colors of the traces

    protected _robotSceneManager: RobotSceneManager | undefined;

    protected _update: boolean; // whether traces are added or removed

    protected _backgroundColor: string;

    protected _worldFrameObject: T.Object3D; // the actual world frame object

    constructor(parentRobotSceneManager?: RobotSceneManager, id?:string) {
        super();

        // Robot Interface
        this._robots = new Map();

        this._id = new Id(id);
        this._color = randColor();
        this._name = "Static Robot Scene " + (++numScenes);

        this._colorPalettes = [...palettes];

        this._update = false;

        this._traces = [];

        this._worldFrameObject = new T.Object3D();
        this.addWorldFrame();

        this._backgroundColor = "#263238"; // default background color of the scene
        this._robotSceneManager = parentRobotSceneManager;

        if(parentRobotSceneManager !== undefined)
            parentRobotSceneManager.addStaticRobotScene(this);
    }


    /**
     * add a child robot that are posed at a given time frame
     * @param robot 
     * @param time 
     */
    addChildRobot(robot:Robot, time: number) {
        let frameData = robot.parentScene()?.frameData([time]);
        let newRobot = robot.clone();
        
        if(frameData !== undefined) {
            let robotFrameData = frameData.get(robot);
            if(robotFrameData !== undefined){
                // console.log(robotFrameData)
                let angle_map = new Map();
                for(const [joint, angles] of robotFrameData.jointAngles)
                    angle_map.set(joint.name(), angles[0])
                let animate_frame: animation_frame = {time: time, angleMap: angle_map};
                let positions = robotFrameData.positions.get(undefined);
                let rotations = robotFrameData.rotations.get(undefined);
                if(positions !== undefined) animate_frame.position = positions[0];
                if(rotations !== undefined) animate_frame.position = rotations[0];
                // console.log(animate_frame)
                newRobot.applyFrame(animate_frame);
            }
        }
        newRobot.setParentStaticRobotScene(this);
        this._robots.set(newRobot.idValue(), newRobot);
        APP.updateUI();
    }

    hasChildRobot(robotId: String){
        return this._robots.get(robotId) !== undefined;
    }

    removeChildRobot(robotId:String) {
        this._robots.delete(robotId);
    }

    // ----------
    // helper functions to control whether or not to show the world frame
    isWorldFrameObjectVisible(): boolean
    {
        return this._worldFrameObject.visible;
    }
    setWorldFrameObjectVisibility(visible: boolean)
    {
        this._worldFrameObject.visible = visible;
        this.render();
    }

    backgroundColor(): string
    {
        return this._backgroundColor;
    }
    setBackgroundColor(newColor: string)
    {
        this._backgroundColor = newColor;
        this.scene().background = new T.Color(newColor);
        this.render();
    }

    addWorldFrame():T.Object3D {
        // add world frame object directly to the scene
        // do not add world frame object to the scene's children robots
        let worldFrameObject: T.Object3D = new T.AxesHelper(1);
        this._worldFrameObject = worldFrameObject;
        this.scene().add(worldFrameObject);
        this.render();
        return worldFrameObject;
    }


    /**
     * @returns The parent RobotSceneManager of this RobotScene.
     */
    robotSceneManager(): RobotSceneManager | undefined {
        return this._robotSceneManager;
    }
    
    /**
     * extract frame data and store them in a map
     * @param robotScene 
     * @param robot 
     * @param times 
     * @param robotPart 
     * @returns 
     */
    static extraceDataFromframeData(robotScene: RobotScene, robot:Robot, times: number[], robotPart?: undefined | RobotJoint | RobotLink): Map<undefined | RobotJoint | RobotLink, T.Quaternion[]>
    {
        let rotations: Map<undefined | RobotJoint | RobotLink, T.Quaternion[]> = new Map();
        
        if (robotPart === undefined) {
            rotations.set(robotPart, robotScene.frameDataFor(robot, times, robotPart, true).robotRotations);
        } else if (robotPart instanceof RobotJoint) {
            rotations.set(robotPart, robotScene.frameDataFor(robot, times, robotPart, true).jointRotations);
        } else if (robotPart instanceof RobotLink) {
            rotations.set(robotPart, robotScene.frameDataFor(robot, times, robotPart, true).linkRotations);
        } else {
            throw new AssertionError({ message: "robotPart was not a boolean, RobotJoint, or RobotLink!" });
        }
        return rotations;
    }


    id():Id { return this._id; }
    update(): boolean {return this._update};
    setUpdate(update: boolean) {this._update = update;}

    color(): string { return this._color; }
    setColor(newColor: string) { this._color = newColor; this.render(); }


    /**
     * Returns the T.Scene that this RobotScene uses.
     * @returns The T.Scene that this RobotScene uses.
     */
    scene():T.Scene {
        return this._scene;
    }
}