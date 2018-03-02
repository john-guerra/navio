import React, { Component } from 'react';
import { Switch, Button, Select, Tooltip } from 'antd';
import * as d3 from "d3";
const Option = Select.Option;
class Menu extends Component {
	state = {
		size: 'default',
	}
	onChange(checked) {
	  console.log(`switch to ${checked}`);
	}
	componentDidUpdate(){
		if(this.props.loaded){
			let selection = d3.select("#menu")
								.style("transition", "visibility 1s")
								.style("visibility","visible");
			console.log(selection,'selection')
		}
	}
	clickAtt(i){
		console.log(i,'i')
		let attributes = this.props.attributes;
		let va=!attributes[i].check;
		attributes[i].checked=va
		console.log(attributes)
		this.props.setAttributes(attributes);
	}
	handleChange = (attr,value) => {
		console.log(attr,value)
		this.props.changeTypeStatus(attr,value);
	}
	render(){
		const { size } = this.state;
		return(
			<div id="menu" className="menu">
				<div className="ids">
					<div className="ids-title">
						<p>ID</p>
					</div>
					
					<div className="ids-container">
					{
						this.props.ids.map((d,i)=>{
							return (
								<Button 
									className="id" 
									key={i} 
									type="dashed"
								>
									{d}
								</Button>
							);
						})
					}
					</div>

				</div>
				<div className="attributes">
					<div className="attributes-title">
						<p>Attributes</p>
					</div>
					<div className="attributes-container">
					{
						this.props.attributes.map((d,i)=>{
							return (
								<div className="attribute">
									<div className="attribute-name">
										<span>{d.name}</span> 
									</div>
									<div className="attribute-select">
										<Select
								          size={size}
								          defaultValue={d.type}
								          onChange={(value)=>this.handleChange(d,value)}
								          className="attribute-select-item"
								        >
								        	<Option key={"categorical"} value={"categorical"} >categorical</Option>
								        	<Option key={"sequential"} value={"sequential"}>sequential</Option>
								        </Select>
									</div>
									<div className="attribute-switch">
										<Tooltip placement="right"  title="Here you can change this dimension visibility">
										    <Switch className="attribute" defaultChecked onChange={(checked)=>this.props.changeCheckStatus(d,checked)} />
										</Tooltip>
									</div>
								</div>
								)
						})
					}
					</div>
				</div>
			</div>
		)
	}
}
export default Menu;