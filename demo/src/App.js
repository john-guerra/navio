import React, { Component } from 'react';
import  Main from './modules/Main.jsx';
class App extends Component {
  render() {
    return (
      <div className="Main-app">
        <div className="container">
          <div className="App-title">
            <h1 className="heading">
                <a target="_blank" href="https://github.com/john-guerra/nodenavigator"> <i class="fa fa-github" aria-hidden="true"> </i></a>
                 NodeNavigator
            </h1>

          <hr></hr>
          </div>
          <Main/>
        </div>
      </div>
    );
  }
}

export default App;
