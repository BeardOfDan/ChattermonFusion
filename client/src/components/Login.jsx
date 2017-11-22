import React, { Component } from 'react';
import { Link, Route, Redirect } from 'react-router-dom';
import css from '../styles.css';
import axios from 'axios';

export default class Login extends Component {
  constructor(props) {
    super(props);

    this.state = {
      username: '',
      password: '',
      registered: undefined
    };

    this.handleUsernameChange = this.handleUsernameChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
    this.handleSubimt = this.handleSubimt.bind(this);
  }

  handleUsernameChange(e) {
    console.log('Username changed to', e.target.value);

    this.setState({
      username: e.target.value
    });
  }

  handlePasswordChange(e) {
    console.log('Password changed to', e.target.value);

    this.setState({
      password: e.target.value
    });
  }

  handleSubimt() {
    console.log('click\'d');
    const username = this.state.username;
    const password = this.state.password;
    axios({
        method: 'post',
        url: '/login',
        baseUrl: process.env.baseURL || 'http://localhost:3000',
        data: { username, password }
      })
      .then(resp => {
        if (resp.data.match('Not Found')) {
          console.log("user not found");
          this.setState({
            registered: false
          });
        } else {
          console.log("user found");
          this.setState({
            registered: true
          });
        }
      })
  }

  render() {
    if (this.state.registered === false) {
      return (
        <Redirect to="/signup"/>
      )
    }
    else if (this.state.registered === true) {
      return (
        <Redirect to="/home"/>
      )
    }
    else {
      return (
        <div>
          <div className={css.navBar}>
            <div className={css.logo}>Chattermon</div>
            <div className={css.navBarLinksContainer}>
              <Link to={'/signup'} className={css.navBarLinkA}><div className={css.navBarLink}>Sign Up</div></Link>
            </div>
          </div>

          <div className={css.contentSuperWrapper}>
            <div className={css.welcomeControlPannel}>
              <div className={css.welcomeMessage}>Welcome Back</div>
              <div className={css.controlsContainer}>
                <div className={css.joinGameContainer}>
                  <input type="text" className={css.signInUpField} placeholder="Username" value={this.state.username} onChange={this.handleUsernameChange}></input>
                  <input type="password" className={css.signInUpField} placeholder="Password" value={this.state.password} onChange={this.handlePasswordChange}></input>
                  <button className={css.gameButton} onClick={this.handleSubimt}>Login</button>
                </div>
                <div className={css.seperator}></div>
                <div className={css.altAuthText}>New here?</div>
                <Link to='/signup' className={css.gameButtonLink}><button className={css.gameButton}>Sign up</button></Link>
              </div>
            </div>
          </div>
        </div>
      )
    }
  }
}
