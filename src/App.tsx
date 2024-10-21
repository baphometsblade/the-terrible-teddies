import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import BattleArena from './components/BattleArena';
import Collection from './components/Collection';
import Shop from './components/Shop';
import DeckBuilder from './components/DeckBuilder';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app">
        <Header />
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/battle" component={BattleArena} />
          <Route path="/collection" component={Collection} />
          <Route path="/shop" component={Shop} />
          <Route path="/deck-builder" component={DeckBuilder} />
        </Switch>
      </div>
    </Router>
  );
};

export default App;