import React, { Component, createRef } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { LabeledTextInput } from "../LabeledTextInput";
import { LabeledCheckBox } from "../LabeledCheckBox";
import { APP } from "../../constants";
import { RobotJointsPanel } from "./RobotJointsPanel";
import { AnimationManager } from "../../AnimationManager";
import { AnimationEditor } from "../AnimationEditor";
import {
    Accordion,
    AccordionItem,
    AccordionItemHeading,
    AccordionItemButton,
    AccordionItemPanel,
  } from 'react-accessible-accordion';
import { DataTable } from "../DataTable";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { PopupHelpPage } from "../popup_help_page";


export interface robot_options_panel_props {
    robotSceneManager: RobotSceneManager,
    getParentDockLayout: () => DockLayout | undefined,
    animationManager: AnimationManager,
}

interface robot_options_panel_state {
    counter:number,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    dropdowns: boolean[], // keep track of all dropdown menus, true means selected, false otherwise
    currDataType: dataType, // which of the 4 data types are currently selected
    currSpeciProperty: speciProperties, // the details, i.e. x, y, z, angle...
    need_update: boolean, // need to update graph data to trigger fillGraphData
    show_data: boolean,
}
export interface time_obj{
    start: number,
    end: number,
    curr: number
}
type speciProperties = "x" | "y" | "z" | "angle";
type dataType = "position"|"velocity"|"acceleration"|"jerk";
type OptionList = {name:string};
export class RobotOptionsPanel extends Component<robot_options_panel_props, robot_options_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected data_types:dataType[] = ["position", "velocity","acceleration","jerk"];
    protected speci_property_types: speciProperties[] = ['x', 'y', 'z', 'angle']; // TODO need to update, should use speciProperties instead of vectorKeys
    protected selectedOptions: OptionList[] = [];
    protected dropdownRef : any [] = []; 
    // protected isTimeWarp: boolean,
   
    constructor(props: robot_options_panel_props) {
        super(props);
        const {robotSceneManager} = this.props;
        this.state = {
            counter: 0,
            panelHeight: 620,
            panelWidth: 1200,
            dropdowns: [false, false],
            currDataType: this.data_types[0],
            currSpeciProperty: this.speci_property_types[0],
            need_update: true,
            show_data: false,
        };
        this._graphDiv = createRef();
        for (let i = 0; i < 2; i++) this.dropdownRef[i] = createRef();

        this.onShowRobot = this.onShowRobot.bind(this);
        this.onOpacityChange = this.onOpacityChange.bind(this);
    }


    /**
     * Helper function to compute number of true in a boolean array
     * @param arr 
     * @returns sum of arr
     */
    booleanSum(arr:boolean[]):Number{
        let sum = 0;
        for(const a of arr){
            sum += Number(a);
        }
        return sum;
    }

    componentDidUpdate(prevProps:robot_options_panel_props) {
    }
    /**
     * deselect the chosen dropdown, 
     * it automatically reset the subsequent selection (display the placeholder value),
     * and set the curresponding dropdown to false
     * @param index 
     * @returns 
     */   
    deselectDropdowns(index: number)
    {
        this.state.dropdowns[index] = false;
        if(this.dropdownRef[index+1] != undefined)
            this.dropdownRef[index+1].current.setValue(this.dropdownRef[index+1].current.state.prevProps.placeholder);
    }

    /**
     * select the chosen dropdown, set the curresponding dropdown to false
     * @param index 
     * @returns 
     */   
    selectDropdowns(index: number)
    {
        this.state.dropdowns[index] = true;
    }

    /**
     * Handle changing property
     * @param e 
     * @returns 
     */
    onChangeProperty(e:any){
        this.deselectDropdowns(0);
        const value = e.value;
        if(!value) return;
        this.setState({
            currDataType: value
        });
        this.selectDropdowns(0);
    }

     /**
     * Handle changing a specific property
     * @param e 
     * @returns 
     */
    onChangeSpeciProperty(e:any){
        //TODO deactivate scenes after nothing is graphed?
        this.state.dropdowns[1] = false;
        const value = e.value;
        if(!value) return;
        this.setState({
            currSpeciProperty: value
        });
        this.selectDropdowns(1);
        const {currDataType} = this.state;
        this.onUpdate(currDataType, value);
    }

    /**
     * Handle update graph button clicks
     */
    onUpdate(currDataType:string, currSpeciProperty:string){
        for(let i=0; i<2; i++) // check whether the first four dropdowns are selected
        {
            if(!this.state.dropdowns[i])
                throw new Error(`${i} Not every dropdown is selected. Need to select all dropdowns to show the graph`);
        }
        
        console.log("on Update");
    }

    /**
     * decompose the eventName
     * to sceneId, robotName, partName, currSpeciProperty, currDataType
     * @param eventName
     * @returns 
     */
    decomposeEventName(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName, currSpeciProperty, currDataType] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName, currSpeciProperty, currDataType];
    }

    onShowRobot(event:React.FormEvent<HTMLInputElement>) {
      const { robotSceneManager } = this.props;
      const currScene = robotSceneManager.currRobotScene();
      if (currScene === undefined) return;
      const currRobot = currScene.selectedRobot();
      if (currRobot === undefined) return;
      currRobot.setVisible(event.currentTarget.checked);
      APP.updateUI();
    }

    onOpacityChange(event:React.FormEvent<HTMLInputElement>) {
      let value = event.currentTarget.valueAsNumber;
      if (value) {
        const { robotSceneManager } = this.props;
        const currScene = robotSceneManager.currRobotScene();
        if (currScene === undefined) return;
        const currRobot = currScene.selectedRobot();
        if (currRobot === undefined) return;
        currRobot.setOpacity(value);
        this.forceUpdate(); // forces rerender so that the label above the slider can update
      }
    }

    onShowData()
    {
      this.setState({
        show_data: !this.state.show_data
      });
    }
    // check if time has changed in render manually
    render() {
        //const isTimeWarp = this.props.isTimeWarp;
        const {robotSceneManager} = this.props;
        const currScene = robotSceneManager.currRobotScene();
      if (currScene === undefined) return (
        <div className={"RobotOptionPanel"} key={newID(4)}>
          This tab is for selecting which robot (if any)
          you would like. You do not have an robot selected currently,
          so this cannot be done. Please select an robot.
        </div>
      );
      const currRobot = currScene.selectedRobot();
      if (currRobot === undefined) return (
        <div className={"RobotOptionPanel"} key={newID(4)}>
          This tab is for selecting which robot (if any)
          you would like. You do not have an robot selected currently,
          so this cannot be done. Please select an robot.
        </div>
      );
        // if(this.props.currScene === undefined || this.props.currRobot === undefined)
        // {
        //     return (
        //       <div className={"RobotOptionPanel"} key={newID(4)}>
        //                 This tab is for selecting which robot (if any) 
        //                 you would like. You do not have an robot selected currently, 
        //                 so this cannot be done. Please select an robot.
        //             </div>
        //     );
        // }
        // const {currScene, currRobot} = this.props;
        let opacity = currRobot.opacity();
        const selectStyles = {
            option: (provided: any) => ({
              ...provided,
              color: 'black',
              fontSize: '15px',
            }),
            control: (base: any) => ({
              ...base,
              height: '100%',
              width: '100%',
              fontSize: '15px',
            }),
            container: (provided: any, state: any) => ({
              ...provided,
              height: '100%',
              width: '100%',
              display: 'inline-flex',
              fontSize: '15px',
            }),
            placeholder:(provided: any) => ({
              ...provided,
              fontSize: '15px',
            }),
          };

        return (
          <div className={"RobotOptionPanel"} ref={this._graphDiv}>
            <div className="PopUpGroup">
              <LabeledTextInput
                labelValue="Name:"
                value={currRobot.name()}
                onReturnPressed={(currValue) => {
                  currRobot.setName(currValue);
                }}
              />
              <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.RobotOptionPanel)}>
                <FontAwesomeIcon className="Icon" icon={faQuestion} />
              </button>
            </div>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Robot Appearance
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <div className="RobotSelectorPanel">
                    <div className="RobotPanel" style={{ marginBottom: "10px" }}>
                      {/* <LabeledTextInput
                        labelValue="Name:"
                        value={currRobot.name()}
                        onReturnPressed={(currValue) => {
                          currRobot.setName(currValue);
                        }}
                      /> */}
                      <LabeledCheckBox
                        label="Show Object"
                        checked={currRobot.visible()}
                        onChange={this.onShowRobot}
                      />
                      <div>
                        <div>
                          <label>Robot Opacity: {opacity}</label>
                        </div>
                        <div>
                          <input
                            type="range"
                            min={-0.01}
                            step={0.01}
                            max={1}
                            value={opacity}
                            onChange={this.onOpacityChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  }
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Edit Object Positions/Robot Joints
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <RobotJointsPanel
                      robotScene={currScene}
                      robot={currRobot}
                    />
                  }
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Edit Motion Data
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <div>
                      <AnimationEditor
                        robotScene={currScene}
                        animationManager={this.props.animationManager}
                        robotSceneManager={this.props.robotSceneManager}
                        robot={currRobot}
                      />

                      <button onClick={this.onShowData.bind(this)} style={{marginTop: "1rem"}}>show raw data</button>
                      {this.state.show_data && <DataTable
                        robotScene={currScene}
                        animationManager={this.props.animationManager}
                        robotSceneManager={this.props.robotSceneManager}
                        robot={currRobot}
                      />}
                    </div>
                  }
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
            
          </div>
        );
    }
}