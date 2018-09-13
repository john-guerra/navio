import React from 'react';
import { connect } from 'react-redux';
import { Button, Icon, Tooltip } from 'antd';
import { resetData, toggleSidebar } from './../../../actions';
import FileSaver from 'file-saver';

const ButtonGroup = Button.Group;
const ActionGroup = ({ exportData, data, attributes, resetData, toggleSidebar }) => {
  const download = () => {
    let data = exportData;
    const items = data.slice();
    const replacer = (key, value) => value === null ? '' : value; // specify how you want to handle null values here
    const header = Object.keys(items[0]);
    let csv = items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','));
    csv.unshift(header.join(','));
    csv = csv.join('\r\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    FileSaver.saveAs(blob, 'export_data.csv');
  };
  const exportVisualization = () => {
    let mimeType = 'text/html';
    let catColumns = [];
    let seqColumns = [];
    attributes.forEach(a => {
      if (a.type === 'categorical') {
        catColumns.push(a.name);
      } else {
        seqColumns.push(a.name);
      }
    })
    const elHtml = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="ie=edge">
      <title>Navio</title>
    </head>
    <body>
      <div id="Navio"></div>

      <script src="https://d3js.org/d3.v4.min.js"></script>
      <script src="https://d3js.org/d3-interpolate.v1.min.js"></script>
      <script src="https://d3js.org/d3-scale-chromatic.v1.min.js"></script>
      <script type="text/javascript" src="https://john-guerra.github.io/Navio/Navio.js"></script>
      <script type="text/javascript">
        let nn = new Navio("#Navio", 600);
        let cat = "categorical"
        let seq = "sequential";
      let attributes = JSON.parse('${JSON.stringify(attributes)}');
        d3.csv("./export_data.csv", function (err, data) {
          if (err) throw err;
        data.forEach((row) => {
          attributes.forEach(att=> {
            if(att.data === "date"){
              let mydate = new Date(row[att.name]);
              if(isNaN(mydate.getDate())){
                row[att.name] = null;
              }else {
                row[att.name] = mydate
              }
              
            }
            else if(att.data=== "number"){
              let mynumber = +row[att.name];
              if(isNaN(mynumber)){
                row[att.name] = null;
              }else{
                row[att.name] = mynumber;
              }
            }
          })
        })

        attributes.forEach((d,i)=>{
            if(d.checked){
            console.log("------------");

              if(d.type === cat){
                console.log('cat',d.name);
                nn.addCategoricalAttrib(d.name);
              }else if(d.type === seq){
                console.log('seq',d.name);
                if(d.data=== "date"){
                  console.log('date')
                  nn.addSequentialAttrib(d.name,
                            d3.scalePow()
                              .exponent(0.25)
                              .range([d3.interpolatePurples(0), d3.interpolatePurples(1)]))
                }
                else {
                  nn.addSequentialAttrib(d.name);
                }
                
              }

             console.log("------------");
           }
          })

        nn.data(data);
      });
      </script>
    </body>
    </html>`;
    const link = document.getElementById('downloadLink');
    mimeType = mimeType || 'text/plain';
    const filename = 'index.html';
    link.setAttribute('download', filename);
    link.setAttribute('href', 'data:' + mimeType  +  ';charset=utf-8,' + encodeURIComponent(elHtml));
    // link.click(); 
    download();
  };
  return (
    <div style={{ textAlign: 'center' }}>
      <ButtonGroup>
        <Tooltip
          placement="bottom"
          title="Show sidebar to hide/show attributes and change their type."
        >
          <Button onClick={toggleSidebar}><Icon type="setting" />Setup Navio</Button>
        </Tooltip>
        <Tooltip
          placement="bottom"
          title="Export the filtered data in csv format."
        >
          <Button onClick={download}><Icon type="table" />Export data</Button>
        </Tooltip>
        <Tooltip
          placement="bottom"
          title="Export an embedded version of the visualization (data.csv + index.html)."
        >
          <Button onClick={exportVisualization}>
            <a href="#" id="downloadLink">
              <Icon type="export" />Export visualization
            </a>
          </Button>
        </Tooltip>
        <Tooltip placement="bottom" title="Choose another dataset.">
          <Button onClick={resetData}><Icon type="swap" />Change dataset</Button>
        </Tooltip>
      </ButtonGroup>
    </div>
  );
};

const mapStateToProps = state => ({
  exportData: state.shipyard.exportData,
  data: state.shipyard.data,
  attributes: state.shipyard.attributes,
});

const mapDispatchToProps = dispatch => ({
  resetData: () => dispatch(resetData()),
  toggleSidebar: () => dispatch(toggleSidebar()),
});

export default connect(mapStateToProps, mapDispatchToProps)(ActionGroup);
