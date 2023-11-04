import { Component } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { panel_props } from "./panel";


export interface cameras_panel_props extends panel_props {
    robotSceneManager: RobotSceneManager,
}

interface cameras_panel_state {
}

/**
 * Displays the options for the cameras.
 */
export class CamerasPanel extends Component<cameras_panel_props, cameras_panel_state> {
    constructor(props:cameras_panel_props) {
        super(props);

        this.state = {
        }
    }

    render () {
        return (
            <div className="CamerasPanel">
                <label>Synchronize Cameras</label>
                <input 
                    type="checkbox"
                    checked={this.props.robotSceneManager.shouldSyncViews()}
                    onChange={(event) => {
                        this.props.robotSceneManager.setShouldSyncViews(event.target.checked);
                    }}
                />
            </div>
        );
    }
}