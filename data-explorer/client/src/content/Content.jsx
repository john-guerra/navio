import React, { Component } from 'react';
import Load from './load/Load.jsx';
import Visualization from './visualization/Visualization.jsx';
class Content extends Component {
	render(){
		return(
			<div className="content">
				{ !this.props.loaded? 
					<Load setData={this.props.setData.bind(this)}/>
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