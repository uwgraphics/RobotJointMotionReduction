import React, { Component, createRef } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { LabeledSlider } from "../LabeledSlider";
import { DragButton } from "../DragButton";
import { LabeledTextInput } from "../LabeledTextInput";
import { UmapGraph } from "../../objects3D/UmapGraph";
import { HexColorPicker } from "react-colorful";
import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from 'react-accessible-accordion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
import Switch from '@mui/material/Switch';
import Select from 'react-select'

export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    getParentDockLayout: () => DockLayout | undefined,
    currSelectedGraph: UmapGraph | undefined, // the identifier of currently selected graph tab
    forceUpdateTabNames: () => void,
}

interface graph_panel_state {
    counter:number,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    currRobot: Map<string, string>,
    need_update: boolean // need to update graph data to trigger fillGraphData
}
export interface time_obj{
    start: number,
    end: number,
    curr: number
}
export class UmapGraphOptionPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;
   
    constructor(props: graph_panel_props) {
        
        super(props);
        this.state = {
            counter: 0,
            panelHeight: 620,
            panelWidth: 1200,
            currRobot: new Map<string, string>(),
            need_update: true,
        };
        this._graphDiv = createRef();
    }

    componentDidUpdate(prevProps:graph_panel_props) {
    }

    /**
     * Handle change line width
     * @param event 
     */
    onChangeLineWidth(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setLineWidth(e);
    }

    onChangeNNeighbors(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setNNeighbors(e);
    }

    onChangeMinDis(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setMinDis(e);
    }

    onChangeSpread(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setSpread(e);
    }

    onBackgroundColorChange(newValue: string) {
      this.props.robotSceneManager.getCurrUmapGraph()?.setBackgroundColor(newValue);
      for(const scene of this.props.robotSceneManager.allStaticRobotScenes())
        scene.setBackgroundColor(newValue);
      this.props.forceUpdateTabNames(); // trigger the graph update instantaneously
    }

    onAxisColorChange(newValue: string) {
      this.props.robotSceneManager.getCurrUmapGraph()?.setAxisColor(newValue);
      this.props.forceUpdateTabNames(); // trigger the graph update instantaneously
    }

    toggleShowLines() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleShowLines();
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleShowAllTraces() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleShowAllTraces();
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleAutoencoder() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleAutoencoder();
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    togglenneighborMode() {
      this.props.robotSceneManager.getCurrUmapGraph()?.togglenneighborMode();
      console.log("toggle nneighbor mode");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleShowNineScenes() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleShowNineScenes();
      console.log("toggle show nine scenes");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleDisplayGap() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleDisplayGap();
      console.log("toggle display gap");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleDisplayStetch() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleDisplayStretch();
      console.log("toggle display stetch");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleDisplayFalseProximity() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleDisplayFalseProximity();
      console.log("toggle display false proximity");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleUMAPType() {
      if(this.props.robotSceneManager.getCurrUmapGraph()?.UMAPType() === "Parametric")
        this.props.robotSceneManager.getCurrUmapGraph()?.setUMAPType("Regular");
      else
        this.props.robotSceneManager.getCurrUmapGraph()?.setUMAPType("Parametric");
      console.log("toggle UMAP type");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleDisplayNeighbors() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleDisplayNeighbors();
      console.log("toggle display neighbors");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleDisplayPointsInRegion() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleDisplayPointsInRegion();
      console.log("toggle display points in region");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    toggleDisplaySpeed() {
      this.props.robotSceneManager.getCurrUmapGraph()?.toggleDisplaySpeed();
      console.log("toggle display speed");
      this.setState({ // triggers scene option panel to update
        need_update: !this.state.need_update
      });
      this.props.forceUpdateTabNames();  // trigger the graph update instantaneously
    }

    /**
     * Generate options for robot part dropdown
     * @returns 
     */
    genRobotPartOptions(){
      let result = [];
      const {robotSceneManager, currSelectedGraph} = this.props;
      let robot = currSelectedGraph?.currRobot();
      if(robot !== undefined){
        result.push({
          value: robot.name(),
          label: robot.name()
        })
        for(const joint of robot.articuatedJoints()){
          result.push({
            value: joint.name(),
            label: joint.name()
          })
        } 
        for(const link of robot.links()){
          result.push({
            value: link.name(),
            label: link.name()
          })
        } 
      }       
      return result; 
    } 

    /**
     * Handle changing scenes
     * @param e 
     * @returns 
     */
    onChangeRobotPart(e:any){
      const value = e.value;
      if(!value) return;
      const {robotSceneManager, currSelectedGraph} = this.props;
      currSelectedGraph?.setSelectedRobotPartName(value);
    }
    render() {
        const {currSelectedGraph} = this.props
        let currStaticRobotScene = this.props.robotSceneManager.getCurrStaticRobotScene();
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
          <div className={"GraphOptionPanel"} ref={this._graphDiv}>
            <div style={{ marginBottom: "5px" }} className="PopUpGroup">
              <LabeledTextInput
                labelValue="Name:"
                value={(currSelectedGraph === undefined) ? "No Umap Graph" : currSelectedGraph.name()}
                onReturnPressed={(currValue) => {
                  if(currSelectedGraph === undefined) return;
                  currSelectedGraph.setName(currValue);
                  this.props.forceUpdateTabNames();
                }}
              />
              <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.UmapGraphOptionPanel)}>
                <FontAwesomeIcon className="Icon" icon={faQuestion} />
              </button>
            </div>
            <div className={"ButtonsContainer"}>
              <DragButton
                buttonValue={"New Umap Graph"}
                title={"Click and drag to create a new Umap Graph"}
                getParentDockLayout={this.props.getParentDockLayout}
                onDragStart={() => {
                  let new_id = newID(4);
                  
                  return [
                    // Tab ID
                    `UmapGraph&${new_id}&motion`,

                    // onDrop Callback
                    (e) => {},
                  ];
                }}
              />
              {/* <DragButton
                buttonValue={"Legend"}
                getParentDockLayout={this.props.getParentDockLayout}
                onDragStart={() => {
                  let new_id = newID(4);
                  return [
                    // Tab ID
                    `UmapLegend&${new_id}&motion`,

                    // onDrop Callback
                    (e) => {},
                  ];
                }}
              /> */}
            </div>
            <div>
              <div>
                <label>UMAP Type: </label>
                <label>Regular</label>
                <Switch
                  checked={currSelectedGraph?.UMAPType() === "Parametric"}
                  onChange={this.toggleUMAPType.bind(this)}
                />
                <label>Parametric</label>
              </div>
              <LabeledSlider
                label={"Line width: "}
                min={0.1}
                max={10}
                step={0.1}
                value={currSelectedGraph?.lineWidth()}
                onChange={this.onChangeLineWidth.bind(this)}
              />
              <LabeledSlider
                label={"number of neighbors: "}
                min={1}
                max={100}
                step={1}
                value={currSelectedGraph?.nNeighbors()}
                //onChange={this.onChangeNNeighbors.bind(this)}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setNNeighbors.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
              <LabeledSlider
                label={"min distance: "}
                min={0}
                max={1}
                step={0.1}
                value={currSelectedGraph?.minDis()}
                //onChange={this.onChangeMinDis.bind(this)}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setMinDis.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
              <LabeledSlider
                label={"spread: "}
                min={0.1}
                max={1}
                step={0.01}
                value={currSelectedGraph?.spread()}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setSpread.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
              <LabeledSlider
                label={"random seed: "}
                min={1}
                max={100}
                step={1}
                value={currSelectedGraph?.randomSeed()}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setRamdomSeed.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
              <LabeledSlider
                label={"loss weight: "}
                min={0}
                max={1}
                step={0.01}
                value={currSelectedGraph?.lossWeight()}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setLossWeight.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
              <Accordion allowZeroExpanded allowMultipleExpanded>
                <AccordionItem>
                  <AccordionItemHeading>
                    <AccordionItemButton style={{ fontWeight: "bold" }}>
                      Background Points:
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <div>
                      <LabeledSlider
                        label={"background points ratio: "}
                        min={0}
                        max={5}
                        step={0.01}
                        value={currSelectedGraph?.backgroundPointsRatio()}
                        onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setBackgroundPointsRatio.bind(this.props.robotSceneManager.getCurrUmapGraph())}
                      />
                      <LabeledSlider
                        label={"max: "}
                        min={0}
                        max={100}
                        step={0.1}
                        value={currSelectedGraph?.backgroundPointsMax()}
                        onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setBackgroundPointMax.bind(this.props.robotSceneManager.getCurrUmapGraph())}
                      />
                      <LabeledSlider
                        label={"min: "}
                        min={-100}
                        max={0}
                        step={0.1}
                        value={currSelectedGraph?.backgroundPointsMin()}
                        onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setBackgroundPointMin.bind(this.props.robotSceneManager.getCurrUmapGraph())}
                      />
                    </div>
                  </AccordionItemPanel>
                </AccordionItem>
              </Accordion>

              <div>
                <label>Autoencoder: </label>
                <label>False</label>
                <Switch
                  checked={currSelectedGraph?.autoencoder().valueOf()}
                  onChange={this.toggleAutoencoder.bind(this)}
                />
                <label>True</label>
              </div>
             
              <div>
                <label>Display: </label>
                <label>Dots</label>
                <Switch
                  checked={currSelectedGraph?.showLines().valueOf()}
                  onChange={this.toggleShowLines.bind(this)}
                />
                <label>Lines</label>
              </div>
              <div>
                <label>All Traces: </label>
                <label>Hide</label>
                <Switch
                  checked={currSelectedGraph?.showAllTraces().valueOf()}
                  onChange={this.toggleShowAllTraces.bind(this)}
                />
                <label>Show</label>
              </div>

              <div>
                <label>display speed</label>
                <Switch
                  checked={currSelectedGraph?.displaySpeed().valueOf()}
                  onChange={this.toggleDisplaySpeed.bind(this)}
                />
              </div>

              <Accordion allowZeroExpanded allowMultipleExpanded>
                <AccordionItem>
                  <AccordionItemHeading>
                    <AccordionItemButton style={{ fontWeight: "bold" }}>
                      Neighbors Settings
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <div>
                      <label>Show Neighbors: </label>
                      <label>after reduction</label>
                      <Switch
                        checked={currSelectedGraph?.nneighborMode().valueOf()}
                        onChange={this.togglenneighborMode.bind(this)}
                      />
                      <label>before reduction</label>
                    </div>
                    <div>
                      <LabeledSlider
                        label={"distance: "}
                        min={0}
                        max={currSelectedGraph?.maxNeighborDistance()}
                        step={0.01}
                        value={currSelectedGraph?.neighborDistance()}
                        onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setNeighborDistance.bind(this.props.robotSceneManager.getCurrUmapGraph())}
                      />
                    </div>
                    <input type="button" value="Clear All Neighbor Points" onClick={() => this.toggleDisplayNeighbors()} />
                  </AccordionItemPanel>
                </AccordionItem>
              </Accordion>
              
              {/* <div>
                <label>Show Robots in </label>
                <label>one scene</label>
                <Switch
                  checked={currSelectedGraph?.showNineScenes().valueOf()}
                  onChange={this.toggleShowNineScenes.bind(this)}
                />
                <label>nine scenes</label>
              </div> */}

              <Accordion allowZeroExpanded allowMultipleExpanded>
                <AccordionItem>
                  <AccordionItemHeading>
                    <AccordionItemButton style={{ fontWeight: "bold" }}>
                      UMAP Diagnose Tool
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <div>
                      <div>
                        <label>display gap</label>
                        <Switch
                          checked={currSelectedGraph?.displayGap().valueOf()}
                          onChange={this.toggleDisplayGap.bind(this)}
                        />
                      </div>
                      <LabeledSlider
                        label={"min 2D gap distance: "}
                        min={0.1}
                        max={10}
                        step={0.01}
                        value={currSelectedGraph?.min2DGapDis()}
                        onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setMin2DGapDis.bind(this.props.robotSceneManager.getCurrUmapGraph())}
                      />
                      <div>
                        <label>display stretch</label>
                        <Switch
                          checked={currSelectedGraph?.displayStretch().valueOf()}
                          onChange={this.toggleDisplayStetch.bind(this)}
                        />
                      </div>
                      <LabeledSlider
                        label={"min 2D stretch distance: "}
                        min={0.1}
                        max={10}
                        step={0.01}
                        value={currSelectedGraph?.min2DStretchDis()}
                        onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setMin2DStretchDis.bind(this.props.robotSceneManager.getCurrUmapGraph())}
                      />
                      <div>
                        <label>display false proximity</label>
                        <Switch
                          checked={currSelectedGraph?.displayFalseProximity().valueOf()}
                          onChange={this.toggleDisplayFalseProximity.bind(this)}
                        />
                      </div>
                      <LabeledSlider
                        label={"min HD gap distance: "}
                        min={0.1}
                        max={10}
                        step={0.01}
                        value={currSelectedGraph?.minHighDGapDis()}
                        onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setMinHighDGapDis.bind(this.props.robotSceneManager.getCurrUmapGraph())}
                      />
                    </div>
                  </AccordionItemPanel>
                </AccordionItem>
              </Accordion>
              <Accordion allowZeroExpanded allowMultipleExpanded>
                <AccordionItem>
                  <AccordionItemHeading>
                    <AccordionItemButton style={{ fontWeight: "bold" }}>
                      Associated Robot Scenes:
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <div>
                      <div>
                        <LabeledSlider
                          label={"Robots Opacity: "}
                          min={0}
                          max={1}
                          step={0.01}
                          value={currStaticRobotScene?.robotOpacity()}
                          // onMouseUp={currStaticRobotScene?.setRobotOpacity.bind(currStaticRobotScene)}
                          onChange={currStaticRobotScene?.setRobotOpacity.bind(currStaticRobotScene)}
                        />
                        <label>Robot Part of the Traces</label>
                        <Select
                          placeholder={"Select a robot part ..."}
                          options={this.genRobotPartOptions()}
                          onChange={this.onChangeRobotPart.bind(this)}
                          isSearchable={true}
                          styles={selectStyles}
                        />
                        <input type="button" value="Clear All Points in the Selected Region" onClick={() => this.toggleDisplayPointsInRegion()} />
                      </div>
                    </div>
                  </AccordionItemPanel>
                </AccordionItem>
              </Accordion>
              <Accordion allowZeroExpanded allowMultipleExpanded>
                <AccordionItem>
                  <AccordionItemHeading>
                    <AccordionItemButton style={{ fontWeight: "bold" }}>
                      Background Color:
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <HexColorPicker
                      color={currSelectedGraph?.backgroundColor()}
                      onChange={(newColor) => this.onBackgroundColorChange(newColor)} />
                  </AccordionItemPanel>
                </AccordionItem>
              </Accordion>
              <Accordion allowZeroExpanded allowMultipleExpanded>
                <AccordionItem>
                  <AccordionItemHeading>
                    <AccordionItemButton style={{ fontWeight: "bold" }}>
                      Axis Color:
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <HexColorPicker
                      color={currSelectedGraph?.axisColor()}
                      onChange={(newColor) => this.onAxisColorChange(newColor)} />
                  </AccordionItemPanel>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        );
    }
}