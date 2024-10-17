import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import Battle from './components/Battle/Battle';
import Collection from './components/Collection';
import Shop from './components/Shop';
import SurvivalMode from './components/SurvivalMode';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app">
        <Header />
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/battle" component={Battle} />
          <Route path="/collection" component={Collection} />
          <Route path="/shop" component={Shop} />
          <Route path="/survival" component={SurvivalMode} />
        </Switch>
      </div>
    </Router>
  );
};

export default App;