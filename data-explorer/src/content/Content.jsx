import React, { Component } from 'react';
import * as d3 from "d3";
import { Icon } from 'antd';
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
								<div>								
									<Icon type="loading" />
								</div>
								<div>
									<h1>loading...</h1>	
								</div>
							</div>
							
						}
						
					</div>
					:
					<Visualization
						setLoading={this.props.setLoading}
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