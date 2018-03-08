import React, { Component } from "react";
export default class Table extends Component {
	render(){
		return (
				<div className="table">
					<h1>	Table Component</h1>
					{this.props.exportData.slice(15).map(d=>{
						return (<p>{d.name}</p>)
					})}

				</div>
			)
	}
};