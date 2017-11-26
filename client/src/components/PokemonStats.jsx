import React, { Component } from 'react';
import css from '../styles.css';

const PokemonStats = (props) => {
  console.log(props);
  return (
    <div className={css.stats}>
      <h2>{props.stats.name.toUpperCase()}</h2>
      <h4 style={{marginBottom: '0px'}}> {props.stats.health} / {props.stats.initialHealth} </h4>
      <h6 style={{margin: '2px'}}> atk: {props.stats.attack} - def: {props.stats.defense} </h6>
    </div>
  )
}

export default PokemonStats; 