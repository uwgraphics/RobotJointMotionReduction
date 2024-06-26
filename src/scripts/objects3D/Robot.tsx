import { URDFRobot } from "urdf-loader";
import { clamp, enumerate, getDesaturatedColor, recurseMaterialTraverse } from '../helpers';
import { APP } from '../constants';
import { isMesh, isAxesHelper, isLineSegments} from '../gaurds';
import { RobotJoint } from './RobotJoint';
import { RobotLink } from './RobotLink';
import { animation_frame } from '../AnimationTable';
import { fromXYZ, fromXYZW, toXYZ, toXYZW, xyz, xyzOrder } from '../helpers_serials';
import { AssertionError } from 'assert';
import { loadObject3DFromGlbUrl, loadURDFFromURL } from '../load_functions';
import { Id } from '../Id';
import { RobotScene } from '../scene/RobotScene';
import T from "../true_three";
import { SubscribeArrayWithArg } from "../subscriptable/SubscribeArrayWithArg";
import { SubscriptableValue } from "../subscriptable/SubscriptableValue";
import { StaticRobotScene } from "../scene/StaticRobotScene";


/**
                
       Z                          Z                         Z
       |   X                      |  X                      |  X
       | /                        | /                       | /
 Y-----.                    Y-----.                   Y-----.
     World                    RootGroup                 Robot
        \                    /        \                 /
         \                  /          \               /
      Position/Rotation offset        Position/Rotation from 
      manually added by the user      the motion file
 */


/**
 * The format of the Json generated when the Robot is serialized.
 * 
 * Note: if the serial is generated by a Robot object, then all these
 * fields will be present. The optionals everywhere (?'s) are to make
 * sure that all cases where the fields do not exist for some reason (i.e.
 * someone messed with the Json file) are handled.
 */
export interface serialized_robot {
    // General Info
    name?: string, // Name of the robot
    url?: string, // URL of the robot, or undefined if it is not from a URL
    id?: string, // the unique id of the robot for serialization purposes
    objectType?: 'urdf' | 'object3D',

    // offset manually set by the user
    positionOffset?: xyz,
    scaleOffset?:    xyz,
    rotationOffset?: xyzOrder

    // transform from the motion file
    position?: xyz,
    scale?:    xyz,
    rotation?: xyzOrder,
}

/**
 * A wrapper class around a URDFRobot so that more functionality can be added to
 * it.
 * 
 * Note: The difference between a Robot's name and ID is that, other than when
 * the robot is being loaded in from a Json serialization, the Robot's ID will always be
 * unique for the duration that it is in the application. Multiple Robots,
 * however, can have the same Name. What's more, the name of a robot is something
 * that the user can see whereas the id should never be shown to the user as it
 * is only used by the application to uniquely identify every object.
 */
export class Robot {
    protected _id: Id; // Unique ID that certainly no other Robot in memmory will ever have (this is assured) and no other Robot will probably ever have (not assured but probable) because it is one in 64^64 possibilities
    public _robot: URDFRobot | T.Object3D;
    protected _robotName: string;
    protected _url?: string;

    protected _objectType: 'urdf' | 'object3D'; // the type of object this Robot is from

    protected _highlighted: boolean;
    protected _highlightColor: T.Color;
    protected _desaturated: boolean;

    protected _endEffectorPosition: T.Vector3;
    protected _endEffectorRotation: T.Quaternion;
    protected _endEffectorMesh: T.Mesh;

    protected _rootGroup: T.Group;

    protected _opacity: number;

    protected _visible: boolean;
    protected _shadows: boolean;

    protected _eulerRotation: T.Euler;

    protected _parentScene: SubscriptableValue<undefined | RobotScene>;

    protected _parentStaticRobotScene: StaticRobotScene | undefined;

    protected _meshes: T.Mesh[];
    protected _joints: RobotJoint[];
    protected _articulatedJoints : RobotJoint[];
    protected _jointMap: Map<string, RobotJoint>;
    protected _articulatedJointMap: Map<string, RobotJoint>;
    protected _links: RobotLink[];
    protected _linkMap: Map<string, RobotLink>;

    protected _master?: Robot; // The Robot that spawned this Robot, undefined if this Robot is the master Robot in the RobotSceneManager

    // A clone of this Robot that is controlled by this Robot (the clone is
    // in another scene, so it should exactly match this robot)
    protected _controlledClones: [RobotScene, Robot][];

    protected _includePositionOffsetInTimeWarpConsideration: boolean;
    protected _includePosInTimeWarpConsideration: boolean;

    protected _positionOffset: SubscriptableValue<T.Vector3>;

    protected _sceneCounter: number; // the number of scenes the trace of this robot is in
    protected _graphCounter: number; // the number of graphs this robot is in

    /**
     * Constructs a new Robot object.
     * @param urdfRobot The URDFRobot that this is a wrapper for.
     * @param url The URL where the URDFRobot was loaded from. (for serialization)
     * @param name The Name of the Robot.
     * @param id The id of the Robot. (for serialization)
     */
    constructor(urdfRobot:URDFRobot | T.Object3D, url?:string, name?:string, id?:string, objectType:'urdf' | 'object3D'='urdf', master?:Robot) {
        this._robot = urdfRobot;
        this._objectType = objectType;
        this._id = new Id(id);
        this._master = master;

        this._parentScene = new SubscriptableValue(undefined) as SubscriptableValue<undefined | RobotScene>;

        this._controlledClones = [];

        this._eulerRotation = new T.Euler().setFromQuaternion(this.getWorldQuaternion());

        // this._robotName = (name ?? "unknown_robot").trim().replace(" ", "_");
        this._robotName = (name ?? "unknown_robot").trim();

        this._url = url;

        if (this._robot.quaternion !== undefined) {
            this._robot.quaternion.set(0, 0, 0, 1);
        }

        if (this._robot.position !== undefined) {
            this._robot.position.set(0, 0, 0);
        }
        if (this._robot.scale !== undefined) {
            this._robot.scale.set(1, 1, 1);
        }

        this._sceneCounter = 0;
        this._graphCounter = 0;

        this.render = this.render.bind(this);

        this._rootGroup = new T.Group();

        this._rootGroup.add(this._robot);

        this._positionOffset = new SubscriptableValue(this._rootGroup.position.clone());

        // End Effector
        this._endEffectorPosition = new T.Vector3();
        this._endEffectorRotation = new T.Quaternion();

        let geom = new T.ConeGeometry(0.01, 0.03, 20);
        let mat = new T.MeshStandardMaterial({
            color: "orange"
        });
        this._endEffectorMesh = new T.Mesh(geom, mat);
        this._endEffectorMesh.visible = true;

        // Some setter methods only apply changes if the new value is different
        // from the old value, so do the following just to make sure the changes
        // are applied

        this._visible = false; 
        this.setVisible(true);

        this._shadows = false;
        this.setShadows(true);

        this._opacity = 0;
        this.setOpacity(1);

        this._desaturated = false;
        this._highlighted = false;

        this._highlightColor = new T.Color(0.2, 0.2, 0.4);
        
        // Set up the color states i.e. what is each material's base color,
        //  highlighted color, and desaturated color
        this.traverseMaterials((mat) => {
            if ("color" in mat) {
                // @ts-ignore
                mat.baseColor = mat.color.clone(); // add new field "baseColor" to each material
                // @ts-ignore
                mat.highlightColor = mat.color.clone().add(this._highlightColor); // another new field
                // @ts-ignore
                mat.desaturatedColor = getDesaturatedColor(mat.color, new T.Color(0.2, 0.2, 0.2)); // a third new field
            }

            //mat.alphaToCoverage = true;
            mat.side = T.DoubleSide;

            // also make sure that everything can be less than fully opaque
            mat.transparent = true; // Can become semi-transparent, needed for .opacity property to work
            mat.opacity = this._opacity;
        });

        this.updateColors();

        // Turn off all lights that could be loaded in with the Robot
        this._robot.traverse((c) => {
            let type = c.type as string;

            if (type === "PointLight") {
                let p = c as T.PointLight;
                // One of these stops the light from working
                p.intensity = 0;
                p.castShadow = false;
                p.distance = 0;
                p.visible = false;
            }
        });

        // Some objects start out at (0, 1, 0) so bring them to the ground by
        // default
        this.setPositionOffset(new T.Vector3(0, 0, 0));

        // Quick optimization as a Robot's meshes should not change after
        // construction. If you do need to be able to add/remove meshes
        // after construction, just move this to the this.meshes() function.
        this._meshes = [];
        this.traverseMeshes((mesh) => {
            this._meshes.push(mesh);
        });

        // Another quick optimization, move to this.jointMap() and this.joints()
        // if need the ability to add/remove joints after construction.
        this._jointMap = new Map();
        this._joints = [];
        this._articulatedJointMap = new Map();
        this._articulatedJoints = [];

        if ((this._robot as URDFRobot).joints) {
            // Only a URDF actually has joints so an Object3D can just have an
            // empty list as its joints
            for (const joint of Object.entries((this._robot as URDFRobot).joints)) {
                let robotJoint:RobotJoint = new RobotJoint(this, joint[1], this.render);

                this._jointMap.set(joint[0], robotJoint);
                this._joints.push(robotJoint);

                if (robotJoint.jointType() === 'fixed' || robotJoint.type() === "URDFMimicJoint") {
                    // These joints should NOT be able to rotate, so return from
                    // this callback so that a slider is not added for them.
                    continue;
                }

                this._articulatedJointMap.set(joint[0], robotJoint);
                this._articulatedJoints.push(robotJoint);
            }
        }

        this._linkMap = new Map();
        this._links = [];

        if ((this._robot as URDFRobot).links) {
            // Only a URDF actually has links so an Object3D can just have an
            // empty list as its links
            for (const link of Object.entries((this._robot as URDFRobot).links)) {
                let robotLink:RobotLink = new RobotLink(this, link[1], this.render);

                this._links.push(robotLink);

                this._linkMap.set(link[0], robotLink);

            }
        }

        this._includePositionOffsetInTimeWarpConsideration = false;
        this._includePosInTimeWarpConsideration = false;
    }

    eulerRotation(): T.Euler{
        return this._eulerRotation;
    }

    includePositionOffsetInTimeWarpConsideration(): boolean {
        return this._includePositionOffsetInTimeWarpConsideration;
    }
    
    setPositionOffsetIncludeInTimeWarpConsideration(include: boolean) {
        this._includePositionOffsetInTimeWarpConsideration = include;
        APP.updateUI();
        APP.render();
    }

    includePosInTimeWarpConsideration(): boolean {
        return this._includePosInTimeWarpConsideration;
    }
    
    setPositionIncludeInTimeWarpConsideration(include: boolean) {
        this._includePosInTimeWarpConsideration = include;
        APP.updateUI();
        APP.render();
    }

    setParentRobotScene(newRobotScene: RobotScene | undefined) {
        if (newRobotScene === this._parentScene.value()) { return; }

        this._parentScene.setValue(
            (oldParent, newParent) => {
                // Remove this robot from its current parent scene.
                if (oldParent) {
                    oldParent.scene().remove(this.rootGroup());

                    // Tell RobotSceneManager that it no longer needs to animate this scene
                    // because the controlled robot is no longer in it
                    for (const [] of this._controlledClones) { // eslint-disable-line no-empty-pattern
                        oldParent.robotSceneManager()?.removeControlledRobotScene(oldParent);
                    }
                }

                // Add this Robot to its new parent RobotScene
                if (newParent !== undefined) {
                    newParent.scene().add(this.rootGroup());

                    for (const [] of this._controlledClones) { // eslint-disable-line no-empty-pattern
                        newParent.robotSceneManager()?.addControlledRobotScene(newParent);
                    }
                }
            },
            newRobotScene,
            null
        );

        APP.updateUI();
        APP.render();
    }

    setParentStaticRobotScene(newStaticRobotScene: StaticRobotScene | undefined) {
        if (newStaticRobotScene === this._parentStaticRobotScene) { return; }
        newStaticRobotScene?.scene().add(this.rootGroup());
        APP.updateUI();
        APP.render();
    }

    /// -----------------
    /// Controlled Clones

    /**
     * Returns true if this Robot has a controlled clone in the given RobotScene and false otherwise.
     * @param scene The scene to check.
     * @returns Whether this Robot has a controlled clone in the given scene.
     */
    controlledCloneInScene(scene: RobotScene): boolean {
        for (const [_scene,] of this._controlledClones) {
            if (scene === _scene) {
                return true;
            }
        }
        return false;
    }

    /**
     * Adds a controlled Robot to the scene i.e. since meshes cannot be shared
     * accross scenes, this Robot will clone itself, put that clone into the
     * given scene, and make sure that anything that happens to this Robot also
     * happens to the controlled clone.
     * @param scene The scene to add the controlled clone of this Robot to.
     * @returns The controlled clone of this Robot after it was added to the
     * given scene.
     */
    addControlledClone(scene: RobotScene): Robot {
        for (const [_scene, _robot] of this._controlledClones) {
            if (scene === _scene) {
                // Don't add a controlled clone to the same scene twice.
                return _robot;
            }
        }

        // Add a controlled clone to the given scene
        let controlledClone: Robot = this.clone();

        controlledClone.setParentRobotScene(scene);
        this._controlledClones.push([scene, controlledClone]);

        // Tell the RobotSceneManager that it now needs to animate this scene so
        // that the controlled clone will be animated
        let _parentScene = this._parentScene.value();
        if (_parentScene) {
            _parentScene.robotSceneManager()?.addControlledRobotScene(_parentScene);
        }

        scene.render();
        scene.addGhostRobot(this);
        APP.updateUI();
        return controlledClone;
    }

    /**
     * Removes the controlled clone of this Robot from the given Scene (if there
     * is a controlled clone in the given scene).
     * @param scene The scene to remove the controlled clone from.
     */
    removeControlledClone(scene: RobotScene) {
        for (const [i, key] of enumerate(this._controlledClones)) {
            let otherRobotScene = key[0];
            if (scene === otherRobotScene) {
                key[1].setParentRobotScene(undefined);
                this._controlledClones.splice(i, 1);
                let _parentScene = this._parentScene.value();
                if (_parentScene) {
                    _parentScene?.robotSceneManager()?.removeControlledRobotScene(_parentScene);
                }
                scene.render();
                APP.updateUI();
                break;
            }
        }
    }

    /**
     * Returns the master Robot that this Robot is a copy of.
     * @returns The master Robot that this Robot is a copy of.
     */
    master(): Robot | undefined {
        return this._master;
    }

    /**
     * Sets the master robot that this Robot is a copy of.
     * @param new_master The master that this Robot is a copy of.
     */
    setMaster(new_master: Robot) {
        this._master = new_master;
    }

    objectType():'urdf' | 'object3D' {
        return this._objectType;
    }

    id():Id { return this._id; }
    idValue():string { return this.id().value(); }
    url():string | undefined { return this._url; }
    rootGroup():T.Group { return this._rootGroup; } // returns Group that acts as the root of the tree of meshes that make up this Robot object
    setName(newName:string) { this._robotName = newName; APP.updateUI(); }
    name():string { return this._robotName; }

    isInScene()
    {
        return this._sceneCounter !== 0;
    }
    isInGraph()
    {
        return this._graphCounter !== 0;
    }
    addToScene()
    {
        this._sceneCounter++;
    }

    removeFromScene()
    {
        if(this._sceneCounter > 0)
            this._sceneCounter--;
    }

    addToGraph()
    {
        this._graphCounter++;
    }

    removeFromGraph()
    {
        if(this._graphCounter > 0)
            this._graphCounter--;
    }
    
    /**
     * @returns The group for this robot. Read the Robot class
     * documentation for details.
     */
    getRootGroup():Readonly<T.Group> {
        return this._rootGroup;
    }

    /**
     * Sets the angle of the joint with the given name. If this object does not
     * have a joint with that name, no joint's angle is set.
     * @param jointName The name of the joint to set.
     * @param angle The new angle of the joint.
     */
    setJointAngle(jointName:string, angle:number) {
        let joint = this._articulatedJointMap.get(jointName);
        if (joint) {
            // Update controlled clone
            for (const [,clone] of this._controlledClones) {
                clone.setJointAngle(jointName, angle);
            }
            joint.setAngle(angle);
            this.render();
        }
    }

    jointAngle(jointName:string):undefined | number {
        let joint = this._articulatedJointMap.get(jointName);
        if (joint) {
            return joint.angle();
        }
        return;
    }


    // ------------
    // Position, Rotation and Scale offsets
    
    /**
     * @returns The x, y, z scale manually set by the user.
     */
    getScaleOffset(): T.Vector3 {
        return this._rootGroup.scale.clone();
    }

    /**
     * Allow user to manually set the scale of the Robot on the x, y, z axes
     * @param newScale The new scale of the Robot
     */
    setScaleOffset(newScale:T.Vector3) {
        if (!newScale.equals(this.getScaleOffset())) {
            // Update controlled clone
            for (const [,clone] of this._controlledClones) {
                clone.setScaleOffset(newScale);
            }
            this._rootGroup.scale.set(newScale.x, newScale.y, newScale.z)
            this.render();
        }
    }

    /**
     * Returns the x, y, z position offset of this Robot.
     * @returns Returns the x, y, z position offset of this Robot. This position is
     * always w.r.t the world coordinate.
     */
    getPositionOffset(): T.Vector3 {
        return this._positionOffset.value().clone();
    }

    /**
     * Sets the x, y, z position offset of this Robot.
     * @param newPos The new x, y, z position of the Robot.
     */
    setPositionOffset(newPos:T.Vector3) {
        if (newPos.equals(this.getPositionOffset())) { return; }

        this._positionOffset.setValue(
            null,
            newPos.clone(),
            (_, newPos) => {
                this._rootGroup.position.set(newPos.x, newPos.y, newPos.z);

                // Update controlled clones
                for (const [,clone] of this._controlledClones) {
                    clone.setPositionOffset(newPos);
                }
            }
        );
        this.render();
    }

    beforepositionOffsetSet(): SubscribeArrayWithArg<[T.Vector3, T.Vector3]> {
        return this._positionOffset.beforeSet();
    }

    afterpositionOffsetSet(): SubscribeArrayWithArg<[T.Vector3, T.Vector3]> {
        return this._positionOffset.afterSet();
    }

    /**
     * Returns the x, y, z, w quaternion offset of this Robot.
     * @returns Returns the x, y, z, w quaternion offset of this Robot.
     */
    getQuaternionOffset(): T.Quaternion {
        return this._rootGroup.quaternion.clone();
    }

    /**
     * Sets the quaternion offset of this Robot.
     * @param newQuaternion The new quaternion offset of the Robot.
     */
    setQuaternionOffset(newQuaternion:T.Quaternion) {
        if (!newQuaternion.equals(this.getQuaternionOffset())) {
            // Update controlled clones
            for (const [,clone] of this._controlledClones) {
                clone.setQuaternionOffset(newQuaternion);
            }
            this._rootGroup.quaternion.copy(newQuaternion);
            this.render();
        }
    }

    // ------------
    // Local position, rotation and scale

    /**
     * Returns the local scale of this Robot on each of the x, y, z axis.
     * @returns The x, y, z scale of this Robot.
     */
    getScale(): T.Vector3 {
        return this._robot.scale.clone();
    }

    /**
     * Sets the local scale of the Robot on the x, y, z axises
     * @param newScale The new scale of the Robot
     */
    setScale(newScale:T.Vector3) {
        if (!newScale.equals(this.getScale())) {
            // Update controlled clones
            for (const [,clone] of this._controlledClones) {
                clone.setScale(newScale);
            }
            this._robot.scale.set(newScale.x, newScale.y, newScale.z)
            this.render();
        }
    }

    /**
     * Returns the local position of this Robot.
     * @returns Returns a clone of the x, y, z  position of this Robot.
     */
    getPosition(): T.Vector3 {
        return this._robot.position.clone();
    }

    /**
     * Sets the local position of this Robot.
     * @param newPos The new x, y, z position of the Robot.
     */
    setPosition(newPos:T.Vector3) {
        if (!newPos.equals(this.getPosition())) {
            // Update controlled clones
            for (const [,clone] of this._controlledClones) {
                clone.setPosition(newPos);
            }
            this._robot.position.set(newPos.x, newPos.y, newPos.z);
            this.render();
        }
    }

    // ------------
    // World position, rotation and scale

    /**
     * @returns The position of this Robot in the world coordinate
     */
    getWorldPosition(): T.Vector3 {
        return this._robot.getWorldPosition(new T.Vector3());
    }

    /**
     * @param newPos The new position of this Robot in the world coordinate
     */
    setWorldPosition(newPos:T.Vector3) {
        this.setPosition(this._robot.worldToLocal(newPos));
    }

    /**
     * @returns the quaternion of this RobotLink in the world coordinate
     */
    getWorldQuaternion(): T.Quaternion {
        return this._robot.getWorldQuaternion(new T.Quaternion());
    }
    /**
     * @returns the quaternion of this Robot in the world coordinate
     */
    getQuaternion(): T.Quaternion {
        return this._robot.quaternion.clone();
    }

    /**
     * @param newRotation The quaternion of this Robot in the world coordinate
     */
    setQuaternion(newRotation:T.Quaternion) {
        if (!newRotation.equals(this.getQuaternion())) {
            // Update controlled clones
            for (const [,clone] of this._controlledClones) {
                clone.setQuaternion(newRotation);
            }
            this._robot.quaternion.copy(newRotation);
            this.render();
        }
    }

    // -------------
    // Other Stuff

    /**
     * Returns this Robot's joints as an Array.
     * @returns This Robot's joints as an Array.
     */
    joints():ReadonlyArray<RobotJoint> {
        return this._joints;
    }

    /**
     * Returns this Robot's articulated joints as an Array.
     * @returns This Robot's articulated joints as an Array.
     */
    articuatedJoints():ReadonlyArray<RobotJoint> {
        return this._articulatedJoints;
    }

    /**
     * Returns the joints of this Robot in the format of Map<joint name string, joint>
     * @returns A map of each joint's name and the joint itself.
     */
    jointMap():Readonly<Map<string, RobotJoint>> {
        return this._jointMap;
    }

    /**
     * Returns this Robot's articulated joints as an Array.
     * @returns This Robot's articulated joints as an Array.
     */
    getArticuatedJointMap():Readonly<Map<string, RobotJoint>> {
        return this._articulatedJointMap;
    }

    getFixedJointMap(): Readonly<Map<string, RobotJoint>> {
        let fixedJointMap: Map<string, RobotJoint> = new Map();
        for(const [jointName, joint] of this._jointMap)
        {
            if(!this._articulatedJointMap.has(jointName))
                fixedJointMap.set(jointName, joint);
        }
        return fixedJointMap;
    }

    /**
     * Returns this Robot's links as an Array.
     * @returns This Robot's links as an Array.
     */
    links():ReadonlyArray<RobotLink> {
        return this._links;
    }

    /**
     * Returns the links of this Robot in the format of Map<link name string, link>
     * @returns A map of each link's name and the link itself.
     */
    linkMap():Readonly<Map<string, RobotLink>> {
        return this._linkMap;
    }

    /**
     * Sets the opacity of this Robot.
     * @param opacity The new opacity (in range [0, 1]) of the Robot.
     */
    setOpacity(opacity:number) {
        this._opacity = clamp(opacity, 0, 1);
        this.traverseMaterials((mat) => {
            mat.opacity = this._opacity;
        });

        this.render();
    }

    opacity():number {
        return this._opacity;
    }

    /**
     * Goes to each part of the Robot, takes its base color (the color it is if
     * neither highlighted or desaturated) and adds the given color to it to get
     * the color of the color that that part of the robot should be when the Robot
     * is highlighted.
     * @param color The new highlight color.
     */
    setHighlightColor(color:T.Color) {
        this.traverseMaterials((mat) => {
            if ("color" in mat) {
                // @ts-ignore Set what the highlight color of every material should be
                mat.highlightColor = mat.baseColor.clone().add(color);
            }
        });

        this.updateColors();
    }

    highlightColor():T.Color {
        return this._highlightColor;
    }

    /**
     * Traverses all T.Mesh objects of this Robot, calling
     * the give callback with each one.
     * @param callback The callaback to call with each mesh.
     */
    traverseMeshes(callback: (mesh:T.Mesh) => void) {
        this.rootGroup().traverse((obj) => {
            if (isMesh(obj)) {
                callback(obj);
            } 
        });
    }

    /**
     * Traverses all T.Materials of this Robot, calling the given callback with
     * each one.
     * @param callback The callback to call with each material.
     */
    traverseMaterials(callback:(mat:T.Material) => void) {
        this.rootGroup().traverse((obj) => {
                recurseMaterialTraverse(
                    // @ts-ignore
                    obj.material,
                    callback
                );
        });
    }

    /**
     * Returns a list of all of this Robot's meshes.
     * @returns A list of all of this Robot's meshes.
     */
    meshes(): (T.Mesh) [] {
        return this._meshes;
    }

    /**
     * Returns true if this Robot object is visible and false otherwise.
     * @returns true if this Robot object is visible and false otherwise.
     */
    visible():boolean {
        return this._visible;
    }

    /**
     * Sets whether the Robot should be visible from now on.
     * @param visible true if this Robot should be visible from now on and false
     * if it should not be visible from now on.
     */
    setVisible(visible:boolean) {
        this.traverseMeshes((mesh) => {
            mesh.visible = visible;
        });
        this._visible = visible;

        this.render();
    }

    shadows():boolean {
        return this._shadows;
    }

    setShadows(shadows:boolean) {
        this.traverseMeshes((mesh) => {
            mesh.castShadow = shadows;
            mesh.receiveShadow = shadows;
        });
        this._shadows = shadows;
        this.render();
    }

    highlighted():boolean {
        return this._highlighted;
    }

    setHighlighted(highlighted:boolean) {
        this._highlighted = highlighted;
        this.updateColors();
    }

    desaturated():boolean {
        return this._desaturated;
    }

    setDesaturated(desaturated:boolean) {
        this._desaturated = desaturated;
        this.updateColors();
    }

    /**
     * Applies an animation_frame to this Robot, changing the Robot's
     * values to match the frame of the animation.
     * @param frame The frame to apply to this Robot.
     */
    applyFrame(frame:animation_frame) {
        // Handle Setting Scale
        let s = frame.scale;
        if (s) {
            let newS = this.getScale();
            if (s.x !== undefined) newS.x = s.x;
            if (s.y !== undefined) newS.y = s.y;
            if (s.z !== undefined) newS.z = s.z;
            this.setScale(newS);
        }

        // Handle setting position.
        let p = frame.position;
        if (p) {
            let newP = this.getPosition();
            if (p.x !== undefined) newP.x = p.x;
            if (p.y !== undefined) newP.y = p.y;
            if (p.z !== undefined) newP.z = p.z;
            this.setPosition(newP);
        }

        // Handle setting rotation
        let r = frame.rotation;
        if (r) {
            let newR = this.getQuaternion();
            if (r.w !== undefined) {
                // It's a quaternion
                if (r.x !== undefined) newR.x = r.x;
                if (r.y !== undefined) newR.y = r.y;
                if (r.z !== undefined) newR.z = r.z;
                if (r.w !== undefined) newR.w = r.w;
            } else {
                // It's a Euler Angle
                let eulerRot = new T.Euler();
                if (r.x !== undefined) eulerRot.x = r.x;
                if (r.y !== undefined) eulerRot.y = r.y;
                if (r.z !== undefined) eulerRot.z = r.z;
                newR.setFromEuler(eulerRot);
            }
            this.setQuaternion(newR);
        }

        // Handle setting angles of joints
        let angleMap = frame.angleMap;
        for (const [jointName, angle] of angleMap.entries()) {
            this.setJointAngle(jointName, angle);
        }
    }

    beforeParentSceneSet(): SubscribeArrayWithArg<[undefined | RobotScene, undefined | RobotScene]> {
        return this._parentScene.beforeSet();
    }

    afterParentSceneSet(): SubscribeArrayWithArg<[undefined | RobotScene, undefined | RobotScene]> {
        return this._parentScene.afterSet();
    }

    parentScene(): RobotScene | undefined {
        return this._parentScene.value();
    }

    /**
     * Notifies the scene that it needs to be re-rendered (if possible to notify
     * it).
     */
    render() {
        this._parentScene.value()?.render();
    }

    // Internal Helper Methods

    /**
     * Updates the actual colors of this Robot based on the current color
     * settings.
     */
    protected updateColors() {
        this.traverseMaterials((mat) => {
            if ("color" in mat) {
                if (this._highlighted) {
                    // @ts-ignore
                    mat.color = mat.highlightColor;

                } else if (this._desaturated) {
                    // @ts-ignore
                    mat.color = mat.desaturatedColor;

                } else {
                    // @ts-ignore
                    mat.color = mat.baseColor;
                }
            }
        });

        this.render();
    }

    clone():Robot {
        // Undo any options that may have changed the robot object
        let desaturated = this.desaturated();
        let highlighted = this.highlighted();

        // These change the _robot mesh itself so we need to set them both to
        // false (thus reverting any changes that were made to the mesh) before
        // we clone the mesh. Then, after cloning the mesh, we can set these
        // back to what they were before.
        this.setDesaturated(false);
        this.setHighlighted(false);

        // Clone the URDFRobot object
        let newRobot = this._robot.clone(true);

        // Need to clone the materials because they are not cloned
        // when the robot is yet they are what we change the color of when the
        // color of the object is changed. We need to clone them or else the
        // parent and all its clones will share the same material objects and
        // thus will be set to the same color when one of their colors are set
        newRobot.traverse((obj) => {
            // @ts-ignore
            let mats:T.Material[] | T.Material = obj.material;

            if (mats) {
                if (Array.isArray(mats)) {
                    let clones:T.Material[] = [];
                    for (const mat of mats) {
                        clones.push(mat.clone());
                    }
                    // @ts-ignore
                    obj.material = clones;
                } else {
                    // @ts-ignore
                    obj.material = mats.clone();
                }
            }
        });

        // Create the copy
        let copy = new Robot(
            newRobot,
            this.url(),
            this.name(),
            undefined, // the copy should have a new, different ID
            this._objectType,

            // The master of the copy is either this Robot (if this Robot has no
            // master) or this Robot's master
            this._master === undefined ? this : this._master
        );

        // Set options on copy
        copy.setDesaturated(desaturated);
        copy.setHighlighted(highlighted);

        copy.setOpacity(this.opacity());
        copy.setVisible(this.visible());
        copy.setHighlightColor(this.highlightColor());
        copy.setPosition(this.getPosition());
        copy.setQuaternion(this.getQuaternion());
        copy.setScale(this.getScale());
        copy.setPositionOffset(this.getPositionOffset());
        copy.setQuaternionOffset(this.getQuaternionOffset());
        copy.setScaleOffset(this.getScaleOffset());

        // Restore the options that may have changed the robot object
        this.setDesaturated(desaturated);
        this.setHighlighted(highlighted);

        return copy;
    }

    // ---------------
    // Serialization

    /**
     * Serializes this object into an object that can be jsonified and
     * written to a file.
     */
    serialize():serialized_robot {
        let url:string;
        if (this._url) {
            url = this._url;
        } else {
            // TODO instead of failing here, we should take the robot and insert
            // it directly into the Json in some way i.e. put it in a URDF string
            // and put that string directly into the Json or something.
            throw new Error(`Robot named ${this._robotName} could not be properly serialized because it does not come from a URL.`);
        }

        let pos = this.getPositionOffset();
        let scale = this.getScaleOffset();
        let rot = this.getQuaternionOffset();

        let relPos = this.getPosition();
        let relScale = this.getScale();
        let relRot = this.getQuaternion();

        return {
            name: this._robotName,
            id: this._id.value(),
            url: url,
            positionOffset: toXYZ(pos),
            scaleOffset:    toXYZ(scale),
            rotationOffset: toXYZW(rot),
            position: toXYZ(relPos),
            scale:    toXYZ(relScale),
            rotation: toXYZW(relRot),
            objectType: this._objectType
        };
    }

    /**
     * Deserializes a serialized Robot into a Robot object. If the serial is
     * malformed, undefined is passed as the result instead.
     * @param serial The serialized robot scene.
     * @returns A Promise that resolves to a deserialized Robot on success.
     */
    static async deserialize(serial:serialized_robot):Promise<Robot> {
        if (typeof serial === 'string') serial = JSON.parse(serial);

        // Currently, can only load the robot if it is from a URL
        if (serial.url) {
            let url = serial.url as string;

            let robot = await Robot.loadRobot(url);

            // General
            if (serial.name) robot._robotName = serial.name;
            if (serial.id) robot._id.set(serial.id);

            // transform offset
            robot.setScaleOffset(fromXYZ(robot.getScaleOffset(), serial.scaleOffset));
            robot.setPositionOffset(fromXYZ(robot.getPositionOffset(), serial.positionOffset));
            robot.setQuaternionOffset(fromXYZW(robot.getQuaternionOffset(), serial.rotationOffset));

            // local transform
            robot.setScale(fromXYZ(robot.getScale(), serial.scale));
            robot.setPosition(fromXYZ(robot.getPosition(), serial.position));
            robot.setQuaternion(fromXYZW(robot.getQuaternion(), serial.rotation));

            return robot;
        } else {
            APP.error(`Failed to deserialize a Robot: its serial did not contain a url to the Robot.`);
            throw new AssertionError({message:`Failed to deserialize a Robot: its serial did not contain a url to the Robot.`});
        }
    }

    /**
     * Loads a Robot in from a URDF at the given url.
     * @param url The URL to the URDF file that the robot is in.
     * @returns A promise that resolves ta a Robot on success and rejects on
     * failure.
     */
    static async loadRobot(url:string, objectType?:'urdf' | 'glb' | 'axesHelper', name: string = "" ):Promise<Robot> {
        let robot:URDFRobot | T.Object3D;

        if (objectType === undefined) {
            // Try to auto-detect file
            if (url.trim().toLowerCase().endsWith('.glb')) {
                objectType = 'glb';
            } else {
                objectType = 'urdf';
            }
        }

        if (objectType === 'urdf') {
            robot = await loadURDFFromURL(url);
            if (name === "") {
                name = (robot as URDFRobot).robotName;
            }
        } else if (objectType === 'glb') {
            robot = await loadObject3DFromGlbUrl(url);
            if (name === "") {
                name = "Object"
            }
        } else {
            robot = new T.AxesHelper(0.1);
            if (name === "") {
                name = "EE Target"
            }
        }
        return new Robot(robot, url, name, undefined, objectType === 'urdf' ? undefined : 'object3D')
    }

    static createAxesHelper(size: number, name: string): Robot {
        let robot: T.Object3D = new T.AxesHelper( size );
        return new Robot(robot, "AxesHelper", name, undefined, 'object3D');
    }
}









