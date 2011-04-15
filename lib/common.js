/* Copyright (c) 2010-2011 Ricebridge */

var assert   = require('assert')
var eyes     = require('eyes')
var util     = require('util')
var _        = require('underscore')
var uuid     = require('node-uuid')
var gex      = require('gex')
var crypto   = require('crypto')


function E( err ) {
  if( err ) {
    eyes.inspect(err);
    throw err;
  }
}

_.mixin({
  create:function(o){
    function F() {}
    F.prototype = o;
    return new F();
  }
});

exports.eyes     = eyes
exports.util     = util
exports.assert   = assert
exports._        = _
exports.uuid     = uuid
exports.gex      = gex
exports.crypto   = crypto

exports.E         = E;