import React, { Component } from "react";
import { Table, Icon, Divider } from 'antd';
export default class TablePreview extends Component {
	state = {
		n: 50,
	}
	render(){
		if(this.props.attributes.length!==0 && this.props.exportData.length !==0){
			console.log(this.props.attributes)
			let preview = this.props.exportData.slice(0,this.state.n);
			let columns = []
			this.props.attributes.forEach(a=>{
				if(a.data!=="date"){
					let column = {};
					column.title = a.name;
					column.dataIndex = a.name;
					column.key = a.name;
					column.width = 150;
					columns.push(column);


				}
				
			})
			preview.forEach((p,i)=> {
				p.key=p.__seqId;
			})
			console.log(preview);
			console.log(columns);

			return(
				<div className="table">
					<h1>{`Sample ${preview.length} records` }</h1>

					<Table bordered className="raw-table" pagination={false} dataSource={preview} columns={columns} scroll={{ x: columns.length*150, y: '70vh' }}/>
				</div>

				);

		}
		else{
			return (
				<div className="table">
					<h1>	Sample Data</h1>
				</div>
			)
		}
		
	

		
	}
};