import T from './true_three';
import { AssertionError } from "assert";
import { APP } from "./constants";
import { binarySearchLowerBound, cleanCSV, CSVValTypes, enumerate, gazeboToThreeCoords, lerp, range } from "./helpers";
import { xyz, quaternion } from './helpers_serials';
import { Id } from './Id';
import { loadCSVFromURL } from './load_functions';
import { Quaternion } from 'three';

export interface serialized_animation_table {
    url?: string,
    name: string,
    id: string,
    csv: (number|string)[][],
}

/**
 * Changes the given animation_frame from gazebo to Three coordinates.
 * @param frame The animation_frame to convert.
 * @returns The animation_frame converted to gazebo coordinates (origional frame
 * is modified and returned)
 */
function animFrameFromGazeboToThree(frame:animation_frame): animation_frame {
    let _pos = frame.position ?? { x:0, y:0, z:0 };
    let pos = new T.Vector3(_pos.x ?? 0, _pos.y ?? 0, _pos.z ?? 0);

    let _rot = frame.rotation ?? { x:0, y:0, z:0, w:0 }
    let rot;
    if (_rot.w === undefined) {
        rot = (new T.Quaternion()).setFromEuler(new T.Euler(_rot.x, _rot.y, _rot.z));
    } else {
        rot = new T.Quaternion(_rot.x, _rot.y, _rot.z, _rot.w);
    }

    let [newRot, newPos] = gazeboToThreeCoords(rot, pos);

    frame.rotation = {
        x: newRot.x,
        y: newRot.y,
        z: newRot.z,
        w: newRot.w,
    }

    frame.position = {
        x: newPos.x,
        y: newPos.y,
        z: newPos.z,
    }
    return frame;
}


// The keys of the desc_map of the animation table.
const [X_POS, Y_POS, Z_POS]        = ["X_POS", "Y_POS", "Z_POS"]; // Position
const [X_ROT, Y_ROT, Z_ROT, W_ROT] = ["X_ROT", "Y_ROT", "Z_ROT", "W_ROT"]; // Rotation
const [X_SCL, Y_SCL, Z_SCL]        = ["X_SCL", "Y_SCL", "Z_SCL"]; // Scale

const DESC_MAP:Map<string, string> = new Map();

// For DESC_MAP, each string in each list maps to the last string in each list
// Note: to be case insesitive everything in these must be upper-case
let alternative_headers = {
    X_POS: ["RPOSX", "POS_X", "X", "X_POS"], 
    Y_POS: ["RPOSY", "POS_Y", "Y", "Y_POS"], 
    Z_POS: ["RPOSZ", "POS_Z", "Z", "Z_POS"], 

    X_ROT: ["RROTX", "ROT_X", "RX", "QX", "X_ROT"], 
    Y_ROT: ["RROTY", "ROT_Y", "RY", "QY", "Y_ROT"], 
    Z_ROT: ["RROTZ", "ROT_Z", "RZ", "QZ", "Z_ROT"], 
    W_ROT: ["RROTW", "ROT_W", "RW", "QW", "W_ROT"], // If present, then rotation is represented as an x, y, z, w quaternion

    X_SCL: ["RSCLX", "SCALE_X", "X_SCALE", "X_SCL"], 
    Y_SCL: ["RSCLY", "SCALE_Y", "Y_SCALE", "Y_SCL"], 
    Z_SCL: ["RSCLZ", "SCALE_Z", "Z_SCALE", "Z_SCL"], 
};

for (const header in alternative_headers) {
    for (const alternative_header of alternative_headers[header as keyof typeof alternative_headers]) {
        DESC_MAP.set(alternative_header, header);
    }
}


/**
 * Gets the ith value of the given array and returns it. If i is less than 0,
 * then the first value of the array is returned, if it is more than the length
 * of the array then the last value is returned and if the length of the array
 * is 0 or the arry is undefined then the default is returned.
 */
function getI<T>(arr:T[] | null | undefined, i:number, default_:T):T {
    if (!arr || (arr.length === 0)) return default_;

    if (i <= 0) return arr[0];
    if (i >= (arr.length - 1)) return arr[arr.length - 1];
    return arr[i];
}

export interface animation_frame {
    position?: xyz,
    scale?:    xyz,
    rotation?: quaternion, // If w is present, then this is a quaternion, otherwise it is a euler XYZ angle
    angleMap: Map<string, number>, // map of form Map<joint name, joint angle value>
    time: number, // The time of the frame
}


function csvError(message:string): AssertionError {
    APP.error(`Failed to turn a CSV into an animation table: ${message}`);
    return new AssertionError({ message: `Failed to turn a CSV into an animation table: ${message}` });
}

/**
 * Normally loaded in from a CSV, an animation table is a list of frames, each
 * frame containing a time and the positions of robots / angles of robot joints
 * that robots should have at that point in time.
 * 
 * Note: an AnimationTable, once created, should be considered immutable. Do NOT
 * try to change it as the same AnimationTable object may be used in multiple
 * Animation objects.
 * 
 * Note: The times of the table are always converted of to seconds and are zeroed
 * so that the first frame is always at time 0.
 */
export class AnimationTable {
    protected _url?:string;
    protected _name:string;
    protected _id:Id;

    // The number[] for all three of these are parallel arrays so index 0 in one
    // correpsonds to index 0 in the others. In other words, index 0 represents
    // the first frame of the animation with its time and values, index 1
    // represents the second frame of the animation and its values, and so on
    // and so forth.
    protected _angleMap: Map<string, number[]>;
    protected _descMap: Map<string, number[]>;
    protected _timeTable: number[]; // list of times for each frame in seconds
    protected _robotNames: Set<string> // a set of the robot names in the table

    // flags (use only one)
    public fromGazebo: boolean; // True if animation is using the Gazebo (A.K.A. ROS URDF) coordinate system instead of the Threejs one

    /**
     * Constructs an AnimationTable object.
     * 
     * Note: this constructor is protected because an AnimationTable is an
     * abstraction of the origional format i.e. there could be multiple formats
     * that the animation is in but they are converted to an AnimationTable. To
     * facilitate this, the constructor is protected so you need to use one of the
     * class methods of this class to create an AnimationTable from one of the
     * concrete representations that an AnimationTable can come from.
     * 
     * @param name The name of the AnimationTable.
     * @param id The id of the AnimationTable.
     */
    protected constructor(name?:string, id?:string, url?:string) {
        this._name = name ?? "Unnamed Animation";
        this._name = this._name.trim();

        this._id = new Id(id);

        this._url = url;

        this._angleMap = new Map();
        this._descMap = new Map();
        this._timeTable = [];
        this._robotNames = new Set<string>();

        this.fromGazebo = false;
    }

    robotNames(): Set<string>
    {
        return this._robotNames;
    }

    setName(newName:string) {
        this._name = newName;
        APP.updateUI();
    }

    name():string {
        return this._name;
    }

    id():Id {
        return this._id;
    }

    idValue():string {
        return this._id.value();
    }

    url():string | undefined {
        return this._url;
    }

    /**
     * Loads an animation CSV into the RobotScene from the given URL.
     * @param file The File where the animation CSV is.
     * @param className The className where the error message will be displayed
     * @returns A Promise that resolves to the resulting AnimationTable(s) after
     * it has been added to the RobotScene.
     */
    static async loadFromLocalFile(file:File, className?: string):Promise<AnimationTable[]> {
        let ats = await this.loadFromURL(URL.createObjectURL(file), className);
        for (const at of ats) {
          at.setName(file.name);
        }
        return ats;
    }

    /**
     * Loads an animation CSV into the RobotScene from the given URL.
     * @param url The URL where the animation CSV is.
     * @param className The className where the error message will be displayed
     * @returns A Promise that resolves to the resulting AnimationTable(s) after
     * it has been added to the RobotScene.
     */
    static async loadFromURL(url:string, className?: string):Promise<AnimationTable[]> {
        try {
          let CSVs = await loadCSVFromURL(url, true);
          let ats = [];
          for (const { name, csv } of CSVs) {
            let at = AnimationTable.fromCSV(csv);
            if (at instanceof AssertionError) {
              throw at;
            }

            at.setName(name);
            ats.push(at);
          }
          if (className !== undefined) {
            // Display a success message when the robot is loaded successfully
            const successMessage = "CSV Loaded Successfully!";
            const successElement = document.createElement("p");
            successElement.innerText = successMessage;
            successElement.classList.add("LoadCSVMessage"); // Optional: Add additional styles to the success message

            const loadRobotElement = document.querySelector("." + className);
            console.log(loadRobotElement);
            loadRobotElement?.appendChild(successElement);
          }
          return ats;
        } catch (error) {
          if (className !== undefined) {
            // Display an error message when the URL is not valid
            const errorMessage = "Error loading csv: " + error;
            const errorElement = document.createElement("p");
            errorElement.innerText = errorMessage;
            errorElement.style.color = "red"; // Example of adding a style
            errorElement.classList.add("LoadCSVMessage");
            const loadRobotElement = document.querySelector("." + className);
            loadRobotElement?.appendChild(errorElement);
          }
          // Optionally, you can throw the error again to propagate it to the caller
          throw error;
        }
        
    }

    /**
     * Returns the animation frame that a Robot should have for the given time
     * in the animation. 
     * 
     * Note: The animation_frame objects being returned will always have their
     * values in accordance with the Threejs coordinate system (as described
     * near the top of this file).
     * @param time The time you want the animation values for.
     * @returns The animation frame at the given time.
     */
    frame(time:number, robotName?:string):animation_frame {
        // Get value for column name at time t (in range[0:1]) between the currI
        // and nextI rows of the table.
        let get = (s:string, currI:number, nextI:number, t:number):number | undefined => {
            let table: undefined | number[] =  this._descMap.get(`${robotName}${s}`);

            // First, try to get table for this specific robot
            // // if (robotName !== undefined) {
            //     table =
            // // }

            // If could not get table specific to this robot, then try general
            // table instead
            if (table === undefined) {
                table = this._descMap.get(s);
            }

            // If not even general table worked, then this should return undefined
            // i.e. there is no value for this field for the robot.
            if (table === undefined) {
                return undefined;
            }
            return lerp(getI(table, currI, 0), getI(table, nextI, 0), t); // descriptor table hase table of values so either get the first, last, or inbetween value depending on whether i is in bounds or not
        }

        let getRot = (currI: number): Quaternion | undefined => {
            const rots = [X_ROT, Y_ROT, Z_ROT, W_ROT];
            let rotsData = [];
            for (const rot of rots) {
                let table: undefined | number[] = undefined;

                // First, try to get table for this specific robot
                if (robotName !== undefined) {
                    table = this._descMap.get(`${robotName}${rot}`);
                }

                // If could not get table specific to this robot, then try general
                // table instead
                if (table === undefined) {
                    table = this._descMap.get(rot);
                }

                // If not even general table worked, then this should return undefined
                // i.e. there is no value for this field for the robot.
                if (table === undefined) {
                    return undefined;
                }
                rotsData.push(getI(table, currI, 0));
            }
            let result: Quaternion = new Quaternion(rotsData[0], rotsData[1], rotsData[2], rotsData[3]);
            return result;
        }
        let interpRot = (currI:number, nextI:number, t:number): Quaternion => {
            let result: Quaternion = new Quaternion();
            let currRot = getRot(currI), nextRot = getRot(nextI);
            if(currRot !== undefined && nextRot !== undefined)
                result.slerpQuaternions(currRot, nextRot, t);
            return result;
        }
        // Linearly interpolate between the currI's values and the nextI's
        // values using t
        let manyGet = (currI:number, nextI:number, t:number):animation_frame => {
            let angleMap:Map<string, number> = new Map();

            // Lerp all joint values
            for (const [jointName, angleTable] of this._angleMap.entries()) {
                angleMap.set(jointName, lerp(getI(angleTable, currI, 0), getI(angleTable, nextI, 0), t));
            }

            if (robotName !== undefined) {
                // Now go back through and any joint names that have the robot's
                // name prepended to them (for differentiation purposes) set it to
                // the same value but with that name removed (that way the robot can
                // just get its joint by name and not have to prepend its name to
                // the key)
                for (const [jointName, value] of angleMap.entries()) {
                    if (jointName.startsWith(robotName)) {
                        // NOTE: this will override the joint's default value
                        // for this frame (joint name without the robotName
                        // prepended to it) if there is one, which is a good
                        // thing
                        angleMap.set(jointName.slice(robotName.length, jointName.length), value);
                    }
                }
            }

            let rot: Quaternion = interpRot(currI, nextI, t);
            // Return animation frame
            let res:animation_frame =  {
                position: { x: get(X_POS, currI, nextI, t), y: get(Y_POS, currI, nextI, t), z: get(Z_POS, currI, nextI, t) },
                scale:    { x: get(X_SCL, currI, nextI, t), y: get(Y_SCL, currI, nextI, t), z: get(Z_SCL, currI, nextI, t) },
                rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w},
                // rotation: { x: get(X_ROT, currI, nextI, t), y: get(Y_ROT, currI, nextI, t), z: get(Z_ROT, currI, nextI, t), w: get(W_ROT, currI, nextI, t) },
                angleMap: angleMap,
                time: time,
            };

            if (this.fromGazebo) {
                res = animFrameFromGazeboToThree(res);
            }

            return res;
        }

        if (time <= getI(this._timeTable, 0, 0)) {
            // Time is less than or equal to the first time in the table, so
            // just return the first value of each column

            // Will return first value of each column
            return manyGet(0, 0, 0);

        } else if (time >= getI(this._timeTable, this._timeTable.length - 1, 0)) {
            // Time is more than or equal to the last value of the timeTable, so
            // just return the last value of each column

            // find longest length
            let max_len = 0;
            for (const table of Array.from(this._angleMap.values())) {
                max_len = Math.max(max_len, table.length)
            }
            for (const table of Array.from(this._descMap.values())) {
                max_len = Math.max(max_len, table.length)
            }

            // Will return last value of every column
            return manyGet(max_len, max_len, 0);

        } else {
            // startTime < time < endTime so we must either find a row in the animation table
            // that exactly matches time or the two times that the current time exists between.

            let i = binarySearchLowerBound(this._timeTable, time);
            let lastTime = getI(this._timeTable, i - 1, 0);
            let currTime = getI(this._timeTable, i, 0);
            let t = (time - lastTime) / (currTime - lastTime);
            let res = manyGet(i - 1, i, t);

            // Will interpolate between the rows i - 1 and i with t time
            return res;
        }
    }

    startTime():number {
        return getI(this._timeTable, 0, 0);
    }

    endTime():number {
        return getI(this._timeTable, this._timeTable.length - 1, 0);
    }

    /**
     * Turns this AnimationTable into a CSV.
     * @returns The AnimationTable as a CSV.
     */
    toCSV():(number|string)[][] {
        // Start by declaring the columns of the CSV
        let cols:[string, number[]][] = [];

        // Declares a column. The columns are built from left to right
        let addCol = (header:string, vals:number[]) => {
            cols.push([header, vals]);
        }

        // First column is time
        addCol("time", this._timeTable);

        // Next columns are the descriptions
        for (const [header, values] of Array.from(this._descMap.entries())) {
            addCol(header, values);
        }

        // last columns are the joint angle values
        for (const [header, values] of Array.from(this._angleMap.entries())) {
            addCol(header, values);
        }

        // Now create the CSV from the declared columns
        let createCSV = (cols:[string, number[]][]):(number | string)[][] => {
            let csv:(number|string)[][] = [];

            let maxColLength = 0;

            for (const [, vals] of cols) {
                maxColLength = Math.max(maxColLength, vals.length + 1);
            }

            // Populate csv left to right, row by row
            for (const rowNum of range(maxColLength)) {
                const row:(number | string)[] = [];

                if (rowNum === 0) {
                    // Header Row
                    for (const [header,] of cols) {
                        row.push(header);
                    }
                } else {
                    // Value row
                    for (const [, vals] of cols) {
                        let val = vals[rowNum];
                        if (val === undefined) {
                            val = vals[vals.length - 1];
                            if (val === undefined) {
                                val = 0;
                            }
                        }
                        row.push(val);
                    }
                }

                csv.push(row);
            }

            return csv;
        }

        let csv = createCSV(cols);
        return csv;
    }

    /**
     * Creates an AnimationTable from the given CSV.
     * 
     * Note: the values should be angles in radians.
     * 
     * Note: Column "time" must always be present and can be either
     *       nanoseconds, milliseconds, or seconds.
     * 
     * Note: The column names "rPosX", "rPosY", "rPosZ", "rRotX", "rRotY", "rRotZ",
     *       and "rRotW" are special in that they let  you animate the position
     *       and rotation of the robot being animated.
     * 
     * Example CSV:
     *    [["time", "joint1", "joint2", "joint3"],
     *     [     0,        0,        0,        0],
     *     [    10,     -2.3,     0.23,     1.23],
     *     [    15,     -2.5,    1.234,     2.11],
     *     [    19,     -2.5,    1.235,      1.4]]
     * 
     * Note: this function assumes that the rows are already sorted by time such
     *    that the row with the lowest time value is first and the row with the
     *    longest time value is last.
     * 
     * @param csv The CSV to parse into an AnimationTable.
     * @returns Either a successfully created AnimationTable
     * or, if there was an issue, undefined.
     */
    static fromCSV(csv:(number|string)[][], timeUnit?:"second" | "millisecond" | "microsecond" | "nanosecond"):AnimationTable | AssertionError {
        try {
            csv = cleanCSV({
                csv: csv,
                nonEmpty: true,
                extendCols: true,
                inPlace: true,
                removeDuplicateRows: true,
                valTypes: CSVValTypes.NUMBER,
                fillBadCellsWith: 0,
            });

            let a = new AnimationTable();
            let animationMap: Map<string, number[]> = new Map();
            let robotNames: Set<string> = new Set();
            // first row should have the column names A.K.A. headers
            let headers = csv[0];

            for (const [column, header] of enumerate(headers)) {
                if (typeof header !== "string") {
                    // the header is a number
                    return csvError(`One of the headers was a(n) ${typeof header} (value: "${header}") rather than a string! Check to make sure that all the values of the first row of the CSV are strings naming their column of the CSV.`);
                }

                let headerVals:number[] = [];
                // skipping first row, get all values for the header's column
                for (let row = 1; row < csv.length; row++) {
                    let value = getI(csv[row], column, 0);

                    if (value === "") {
                        continue;
                    }

                    if (typeof value !== "number") {
                        return csvError(`On row ${row} of the CSV, a value was "${value}" rather than a number!`);
                    }
                    headerVals.push(value);
                }
                let trim_header = header.trim().replace(' ', '_');
                const[robotName, partName] = trim_header.split("-");
                robotNames.add(robotName);
                animationMap.set(trim_header.replace('-', ""), headerVals);
            }

            let timeTable = undefined
            if (animationMap.has("time") && animationMap.has("timestamp")) {
                return csvError(`The CSV cannot have both a "time" column and a "timestamp" column. Please remove one of them.`);
            } else if (animationMap.has("time")) {
                timeTable = animationMap.get("time");
            } else if (animationMap.has("timestamp")) {
                timeTable = animationMap.get("timestamp");
            } else {
                return csvError(`There is no "time" or "timestamp" column in the CSV.`);
            }

            if (timeTable === undefined) {
                return csvError(`There is no "time" column in the CSV.`);
            }

            // Times must be in ascending order, so check that they are.
            let timesFound = 0;
            for (let i = 1; i < timeTable.length; i++) {
                let prevTime = timeTable[i - 1];
                let currTime = timeTable[i    ];

                let remove = false;

                if (prevTime > currTime) {
                    APP.warn(`The "time" column of every CSV must contain only ascending values, but descending values were found. Removing descending value.`);
                    timesFound += 1;
                    if (timesFound > 5) {
                        csvError(`${timesFound} values of the "time" column of a CSV were found to be in descending order so the rest are assumed to be as well.`);
                    }
                    remove = true;
                } else if (prevTime === currTime) {
                    remove = true;
                } else {
                    timesFound = 0;
                }

                if (remove) {
                    // Remove the row from every column (this will include the "time" column)
                    for (const colvalues of animationMap.values()) {
                        colvalues.splice(i, 1);
                    }
                    i -= 1; // so that we will repeat this row
                }
            }

            let endTime = timeTable[timeTable.length - 1];
            let startTime = timeTable[0];
            let totalTime = endTime - startTime;

            // zero the "time" column (so timeTable[0] === 0) and convert all of
            // its times to seconds

            if (timeUnit === "second") {
                for(let i = 0; i < timeTable.length; i++) {
                    timeTable[i] -= startTime;
                }
            } else if (timeUnit === "millisecond") {
                for(let i = 0; i < timeTable.length; i++) {
                    timeTable[i] = (timeTable[i] - startTime) / 1000;
                }
            } else if (timeUnit === "microsecond") {
                for(let i = 0; i < timeTable.length; i++) {
                    timeTable[i] = (timeTable[i] - startTime) / 1000000;
                }
            } else if (timeUnit === "nanosecond") {
                for(let i = 0; i < timeTable.length; i++) {
                    timeTable[i] = (timeTable[i] - startTime) / 1000000000;
                }
            } else {
                // Autodetect

                // checks if the total duration is over each threshold
                let isMilli = totalTime > 1000;
                let isMicro = totalTime > 1000000;
                let isNano  = totalTime > 1000000000;

                // zero time and convert it to seconds
                for(let i = 0; i < timeTable.length; i++) {
                    timeTable[i] -= startTime;
                    if (isMilli) timeTable[i] /= 1000;
                    if (isMicro) timeTable[i] /= 1000;
                    if (isNano)  timeTable[i] /= 1000;
                }
            }
        
            a._timeTable = timeTable;
            animationMap.delete("time");

            // add descriptions (robot position, rotation, etc.) to animation table
            for (const [header, table] of animationMap.entries()) {
                let upperHeader = header.toUpperCase();
                for (const [descHeader, newHeader] of DESC_MAP.entries()) {
                    if (upperHeader.endsWith(descHeader)) {
                        // If had robotNameX_Pos, will now have robotNameX_POS
                        // Or if just X_POS, then will now have X_POS
                        a._descMap.set(header.slice(0, header.length - descHeader.length) + newHeader, table);
                        animationMap.delete(header);
                    }
                }
            }

            // We have removed the time table and all the description columns so
            // what is left must be the angle columns
            a._angleMap = animationMap;
            robotNames.delete("time");
            a._robotNames = robotNames;
            // console.log(robotNames);
            return a;
        } catch (e) {
            if (e instanceof AssertionError) {
                return e;
            }
            // should not happen
            throw e;
        }
    }

    serialize():serialized_animation_table {
        const out:serialized_animation_table = {
            id: this.idValue(),
            name: this.name(),
            csv: this.toCSV(),
        };

        if (this._url) {
            out.url = this._url;
        }

        return out;
    }

    /**
     * Note: this is currently a Promise only because all the other deserialize
     * methods are Promises and it may be relevant for it to be a Promise in the
     * future if it ever needs to load anything.
     */
    static async deserialize(serial:serialized_animation_table, donor?:AnimationTable):Promise<AnimationTable> {
        let at = this.fromCSV(serial.csv);
        if (at instanceof AssertionError) {
            throw at;
        }

        donor = donor ?? at;

        if (donor) {
            donor._timeTable = at._timeTable;
            donor._angleMap = at._angleMap;
            donor._descMap = at._descMap;
            if (serial.name) donor._name = serial.name;
            if (serial.id) donor._id.set(serial.id);
            if (serial.url) donor._url = serial.url;
            return donor;
        } else {
            throw new AssertionError({message:"Could not deserialize AnimationTable."});
        }
    }


    copyNumberArray(array: number[])
    {
        let res: number[] = [];
        for(let i=0; i<array.length; i++)
            res[i] = array[i];
        return res;
    }
    clone(): AnimationTable {
         // create a deep copy of the current AnimationTable
         let res = new AnimationTable();
         res._name = this._name;
 
         res._id = new Id();
 
         if(this._url !== undefined)
             res._url = this._url;
 
         res._angleMap = new Map();
         for(const [key, value] of this._angleMap)
         {
             res._angleMap.set(key, this.copyNumberArray(value));
         }
         res._descMap = new Map();
         for(const [key, value] of this._descMap)
         {
             res._descMap.set(key, this.copyNumberArray(value));
         }
         for(const robotName of this._robotNames)
         {
             res._robotNames.add(robotName);
         }
         res._timeTable = [];
         res._timeTable = this.copyNumberArray(this._timeTable);
         res.fromGazebo = this.fromGazebo;
        //let res = AnimationTable.fromCSV(this.toCSV());
        if (res instanceof AssertionError) {
            throw res;
        }
        return res;
    }
}