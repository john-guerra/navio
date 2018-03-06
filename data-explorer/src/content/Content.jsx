import React, { Component } from 'react';
import * as d3 from "d3";
import { Spin } from 'antd';
import Load from './load/Load.jsx';
import Visualization from './visualization/Visualization.jsx';
class Content extends Component {
	componentDidUpdate(){
		if(this.props.loaded){
			d3.select("#content")
			  .style("transition","margin-left 1s")
			  .style("margin-left", 0);
		}else{
			d3.select("#content")
			  .style("margin-left", "-50%");
		}
	}
	render(){
		return(
			<div id="content" className="content">
				{ !this.props.loaded? 
					<div>
						{!this.props.loading ? 
							<Load 
								setLoading={this.props.setLoading}
								loading={this.props.loading}
								datasets={this.props.datasets}
								setData={this.props.setData.bind(this)}
							/>

							:
							<div className="center">
								<Spin size="large" tip="Loading dataset..."/>	
							</div>
							
						}
						
					</div>
					:
					<Visualization
						setLoaded={this.props.setLoaded}
						setLoading={this.props.setLoading}
						data={this.props.data}
						updateCallback={this.props.updateCallback}
						exportData={this.props.exportData}
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