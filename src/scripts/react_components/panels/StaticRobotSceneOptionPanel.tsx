import React, { Component, createRef } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { LabeledSlider } from "../LabeledSlider";
import { DragButton } from "../DragButton";
import { LabeledTextInput } from "../LabeledTextInput";
import { LabeledCheckBox } from "../LabeledCheckBox";
import { HexColorPicker } from "react-colorful";
import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from 'react-accessible-accordion';
import { Id } from "../../Id";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
import { StaticRobotScene } from "../../scene/StaticRobotScene";


export interface static_robot_scene_panel_props {
    robotSceneManager: RobotSceneManager,
    currStaticRobotScene: StaticRobotScene | undefined
    getParentDockLayout: () => DockLayout | undefined,
    forceUpdateTabNames: () => void,
}

interface static_robot_scene_panel_state {
    counter:number,
    update: boolean,
}

export class StaticRobotSceneOptionPanel extends Component<static_robot_scene_panel_props, static_robot_scene_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _quaternionDiv: React.RefObject<HTMLDivElement>;
   
    constructor(props: static_robot_scene_panel_props) {
        
        super(props);
        this.state = {
            counter: 0,
            update: false,
        };
        this._quaternionDiv = createRef();
    }

    componentDidUpdate(prevProps:static_robot_scene_panel_props) {
    }

    onBackgroundColorChange(newValue: string) {
      // console.log(newValue);
      this.props.currStaticRobotScene?.setBackgroundColor(newValue);
    }


    onCheckWorldFrame(event:React.FormEvent<HTMLInputElement>)
    {
      // console.log(event.currentTarget.checked);
      this.props.currStaticRobotScene?.setWorldFrameObjectVisibility(event.currentTarget.checked);
  
      // force this panel to re-render so that the checkbox will be changed instantly after users click it
      this.setState({
        update: !this.state.update
      });
    }
    
  render() {
    const {currStaticRobotScene} = this.props;
    const style3 = {marginBottom: "1rem"};

    // the class name in these element may seems weird
    // they are actually the class name of other elements
    // we give them same class name because we want to
    // apply same styles on these elements
    return (
      <div className={"SceneOptionPanel"} ref={this._quaternionDiv}>
        <div style={style3} className="PopUpGroup">
          <LabeledTextInput
            labelValue="Name:"
            value={(currStaticRobotScene === undefined) ? "No Scene" : currStaticRobotScene.name()}
            onReturnPressed={(currValue) => {
              if (currStaticRobotScene === undefined) return;
              currStaticRobotScene.setName(currValue);
              this.props.forceUpdateTabNames();
            }}
          />
          <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.QSceneOptionPanel)}>
            <FontAwesomeIcon className="Icon" icon={faQuestion} />
          </button>
        </div>
        <div className={"ButtonsContainer"} style={{display: "flex", gap: "1rem"}}>
          <DragButton
            buttonValue={"New Static Robot Scene"}
            title={"Click and drag to create a new quaternion space"}
            className={"Legend"}
            getParentDockLayout={this.props.getParentDockLayout}
            onDragStart={() => {
              let new_id = new Id().value();

              return [
                // Tab ID
                `StaticRobotScene&${new_id}&motion`,

                // onDrop Callback
                (e) => { },
              ];
            }}
          />
          <DragButton
            buttonValue={"Legend"}
            className={"Legend"}
            getParentDockLayout={this.props.getParentDockLayout}
            onDragStart={() => {
              let sceneId: string = (currStaticRobotScene === undefined) ? newID(4) : currStaticRobotScene.id().value();
              return [
                // Tab ID
                `QuaternionSpaceLegend&${newID(4)}&${sceneId}`,

                // onDrop Callback
                (e) => { },
              ];
            }}
          />
        </div>

        <div>
          <LabeledCheckBox
            label="Show World Frame"
            checked={currStaticRobotScene?.isWorldFrameObjectVisible()}
            onChange={this.onCheckWorldFrame.bind(this)} />
        </div>


        <Accordion allowZeroExpanded allowMultipleExpanded>
          <AccordionItem>
            <AccordionItemHeading>
              <AccordionItemButton style={{ fontWeight: "bold" }}>
                Background Color:
              </AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel>
              <HexColorPicker
                color={currStaticRobotScene?.backgroundColor()}
                onChange={(newColor) => this.onBackgroundColorChange(newColor)} />
            </AccordionItemPanel>
          </AccordionItem>
        </Accordion>

      </div>
    );
  }
}