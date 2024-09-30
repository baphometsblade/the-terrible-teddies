import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="bg-purple-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">Terrible Teddies</Link>
        <nav>
          <ul className="flex space-x-4">
            <li><Link to="/battle">Battle</Link></li>
            <li><Link to="/collection">Collection</Link></li>
            <li><Link to="/shop">Shop</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;