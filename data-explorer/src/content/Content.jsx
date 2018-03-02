import React, { Component } from 'react';
import * as d3 from "d3";
import Load from './load/Load.jsx';
import Visualization from './visualization/Visualization.jsx';
class Content extends Component {
	componentDidUpdate(){
		if(this.props.loaded){
			d3.select("#content")
			  .style("margin-left", 0);
		}
	}
	render(){
		return(
			<div id="content" className="content">
				{ !this.props.loaded? 
					<Load 
						datasets={this.props.datasets}
						setData={this.props.setData.bind(this)}
					/>
					:
					<Visualization

						data={this.props.data}
						updateCallback={this.props.updateCallback}
						attributes={this.props.attributes}
						ids={this.props.ids}
						id={this.props.id}
					/>
				}

			</div>
		)
	}
}
export default Content;