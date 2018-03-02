import React, { Component } from 'react';
import { Switch, Button, Icon, Select } from 'antd';
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
				<div className="attributes">
					<p>ID</p>
					<div className="attributes-container">
					{
						this.props.ids.map((d,i)=>{
							return (
								<Button className="attribute" key={i} type="dashed">{d}</Button>
							)
						})
					}

					</div>

				</div>
				<div className="attributes">
					<p>Attributes</p>
					<div className="attributes-container-wrapper">
					{
						this.props.attributes.map((d,i)=>{
							return (
								<div key={i} className="attributes-container">
									<div>
										<span>{d.name}</span> 
										<Select
								          size={size}
								          defaultValue={d.type}
								          onChange={(value)=>this.handleChange(d,value)}
								          style={{ width: 200 }}
								        >
								        	<Option key={"categorical"} value={"categorical"} >categorical</Option>
								        	<Option key={"sequential"} value={"sequential"}>sequential</Option>
								        </Select>
									</div>
									
									<Switch className="attribute" defaultChecked onChange={(checked)=>this.props.changeCheckStatus(d,checked)} />
									{/*<Switch defaultChecked onChange={this.onChange.bind(this)} />*/}
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