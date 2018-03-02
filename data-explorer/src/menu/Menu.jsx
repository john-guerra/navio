import React, { Component } from 'react';
import { Switch, Button, Select, Tooltip, Radio } from 'antd';
import * as d3 from "d3";
const Option = Select.Option;
const RadioGroup = Radio.Group;
class Menu extends Component {
	state = {
		size: 'default',
		value: '',
		closed: false,
	}
	onChangeRadio = (e) => {
	    console.log('radio checked', e.target.value);
	    this.setState({
	      value: e.target.value,
	    }, ()=>{
	    	this.props.setId(e.target.value)
	    });
	 }

	onChange(checked) {
	  console.log(`switch to ${checked}`);
	}
	componentDidUpdate(){
		if(this.props.loaded){
			d3.select("#menu")
					.style("transition", "visibility 1s")
					.style("visibility","visible");
		}else {
			d3.select("#menu")
					.style("transition", "visibility 1s")
					.style("visibility","hidden");
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
	onCloseSidebar = () => {
		this.setState({closed:!this.state.closed});
	}
	render(){
		const radioStyle = {
	      display: 'block',
	      height: '30px',
	      lineHeight: '30px',
	    };
	    const closedStyleMenu = {
	    	position: 'relative',
	    	right: '25%'
	    }
	    let styleMenu = this.state.closed?closedStyleMenu:{};
		const { size } = this.state;
		return(
			<div id="menu" style={styleMenu} className="menu">
				<Button onClick={this.onCloseSidebar} >Close</Button>
				<div className="ids">
					<div className="ids-title">
						<p>ID ({this.props.id}) selected</p>
					</div>
					
					<div className="ids-container">
					  	<RadioGroup onChange={this.onChangeRadio} value={this.state.value}>  
							{
								this.props.attributes.map((d,i)=>{
									console.log(d.name,this.props.id);
									let check = d.name == this.props.id;
									console.log(check);
									return (
										<Radio defaultChecked={d.id} className="id" style={radioStyle} value={d.name}>{d.name}</Radio>
									)
								})
							}
						</RadioGroup>
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