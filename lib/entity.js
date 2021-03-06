/* Copyright (c) 2010-2014 Richard Rodger, MIT License */
/* jshint node:true, asi:true */
"use strict";


var util    = require('util')
var _       = require('underscore')

var common  = require('./common')



function noop(){}


function Entity( canon, seneca ) {
  var self = this

  self.log$ = function() {
    // use this, as make$ will have changed seneca ref
    this.private$.seneca.log.apply(this,arguments)
  }



  var private$ = self.private$ = function(){};

  private$.seneca = seneca

  private$.canon  = canon

  private$.entargs = function( args ) {
    args.role = 'entity'
    args.ent = self

    if( null != this.canon.name ) { args.name = this.canon.name }
    if( null != this.canon.base ) { args.base = this.canon.base }
    if( null != this.canon.zone ) { args.zone = this.canon.zone }
    
    return args
  }

  // use as a quick test to identify Entity objects
  // returns compact string zone/base/name
  self.entity$ = self.canon$()
}







// Properties without '$' suffix are persisted
// id property is special: created if not present when saving
// func$ functions provide persistence operations
// args: (<zone>,<base>,<name>,<props>)
// can be partially specified:
// make$(name)
// make$(base,name)
// make$(zone,base,name)
// make$(zone,base,null)
// make$(zone,null,null)
// props can specify zone$,base$,name$, but args override if present
// escaped names: foo_$ is converted to foo
Entity.prototype.make$ = function() {
  var self = this

  var args = common.arrayify(arguments)

  // set seneca instance, if provided as first arg
  if( args[0] && args[0].seneca ) {
    self.private$.seneca = args.shift()
  }

  var canon

  var argprops = args[args.length-1]
  var props = {}
  if( argprops && 'object' == typeof(argprops) ) {
    args.pop()
    props = _.clone(argprops)      
  }

  while(args.length < 3 ) {
    args.unshift(null)
  }

  var name, base, zone

  if( _.isString(props.entity$) ) {
    canon = parsecanon(props.entity$)
    zone = canon.zone
    base = canon.base
    name = canon.name
  }
  else if( _.isObject(props.entity$ ) ) {
    canon = {}
    canon.zone = zone = props.entity$.zone
    canon.base = base = props.entity$.base
    canon.name = name = props.entity$.name
  }
  else {
    name = args.pop()
    name = null == name ? props.name$ : name

    canon = parsecanon(name)
  }

  name = canon.name

  base = args.pop()
  base = null == base ? canon.base  : base
  base = null == base ? props.base$ : base

  zone = args.pop()
  zone = null == zone ? canon.zone  : zone
  zone = null == zone ? props.zone$ : zone

  var new_canon = {}
  new_canon.name     = null == name ? self.private$.canon.name : name
  new_canon.base     = null == base ? self.private$.canon.base : base
  new_canon.zone     = null == zone ? self.private$.canon.zone : zone

  var entity = new Entity(new_canon,self.private$.seneca)

  for( var p in props ) {
    if( props.hasOwnProperty(p) ) {
      if( !~p.indexOf('$') ) {
        entity[p] = props[p];
      }
      else if( 2 < p.length && '_' == p[p.length-2] && '$' == p[p.length-1] ) {
        entity[p.substring(0,p.length-2)] = props[p];
      }
    }
  }


  if( props.hasOwnProperty('id$') ) {
    entity.id$ = props.id$
  }

  self.log$('make',entity.canon$({string:true}),entity)
  return entity
}


// save one
Entity.prototype.save$ = function(props,cb) {
  var self = this
  var si   = self.private$.seneca

  if( _.isFunction(props) ) {
    cb = props
  }
  else if( _.isObject(props) ) {
    self.data$(props)
  }

  si.act( self.private$.entargs({cmd:'save'}),cb)
  return self
}



// provide native database driver
Entity.prototype.native$ = function(cb) {
  var self = this
  var si   = self.private$.seneca

  si.act( self.private$.entargs({cmd:'native'}),cb||noop)
  return self
}



// load one
// TODO: qin can be an entity, in which case, grab the id and reload
// qin omitted => reload self
Entity.prototype.load$ = function(qin,cb) {
  var self = this
  var si   = self.private$.seneca

  var qent = self

  var q = 
        (_.isUndefined(qin) || _.isNull(qin) || _.isFunction(qin)) ? {id:self.id} :
      _.isString(qin) ? {id:qin} : qin

  cb = _.isFunction(qin) ? qin : cb

  si.act( self.private$.entargs({ qent:qent, q:q, cmd:'load' }), cb||noop )

  return self
}


// TODO: need an update$ - does an atomic upsert


// list zero or more
// qin is optional, if omitted, list all
Entity.prototype.list$ = function(qin,cb) {
  var self = this
  var si   = self.private$.seneca

  var qent = self
  var q = qin
  if( _.isFunction(qin) ) {
    q = {}
    cb = qin
  }

  si.act( self.private$.entargs({qent:qent,q:q,cmd:'list'}),cb||noop )

  return self
}


// remove one or more
// TODO: make qin optional, in which case, use id
Entity.prototype.remove$ = function(qin,cb) {
  var self = this
  var si   = self.private$.seneca

  var q = 
        (_.isUndefined(qin) || _.isNull(qin) ) ? {id:self.id} :
      _.isString(qin) ? {id:qin} : qin

  si.act( self.private$.entargs({qent:self,q:q,cmd:'remove'}),cb||noop )

  return self
}
Entity.prototype.delete$ = Entity.prototype.remove$


Entity.prototype.fields$ = function() {
  var self = this
  var si   = self.private$.seneca

  var fields = [];
  for( var p in self) {
    if( self.hasOwnProperty(p) && '$'!=p && 'function'!=typeof(self[p]) && '$'!=p.charAt(p.length-1)) {
      fields.push(p);
    }
  }
  return fields
}


Entity.prototype.close$ = function(cb) {
  var self = this
  var si   = self.private$.seneca

  self.log$('close')
  si.act( self.private$.entargs({cmd:'close'}), cb||noop)
}


Entity.prototype.canon$ = function(opt) {
  var self = this
  var si   = self.private$.seneca

  var $ = self.private$.canon

  if( opt ) {

    // change type, undef leaves untouched
    $.zone = void 0==opt.zone ? $.zone : opt.zone
    $.base = void 0==opt.base ? $.base : opt.base
    $.name = void 0==opt.name ? $.name : opt.name

    // explicit nulls delete
    if( null === opt.zone ) delete $.zone;
    if( null === opt.base ) delete $.base;
    if( null === opt.name ) delete $.name;

    self.entity$ = self.canon$()
  }

  return ( void 0==opt || opt.string || opt.string$ ) ? 
    [ (opt&&opt.string$?'$':'')+
      (void 0==$.zone?'-':$.zone),
      void 0==$.base?'-':$.base,
      void 0==$.name?'-':$.name].join('/')  
  : opt.array  ? [$.zone,$.base,$.name] 
    : opt.array$ ? [$.zone,$.base,$.name]  
    : opt.object ? {zone:$.zone,base:$.base,name:$.name}
  : opt.object$ ? {zone$:$.zone,base$:$.base,name$:$.name}
  : [$.zone,$.base,$.name]
}


// data = object, or true|undef = include $, false = exclude $
Entity.prototype.data$ = function(data,canonkind) {
  var self = this
  var si   = self.private$.seneca

  // TODO: test for entity$ consistent?

  if( _.isObject(data) ) {

    // does not remove fields by design!
    for( var f in data ) {
      if( '$'!=f.charAt(0) && '$'!=f.charAt(f.length-1) ) {
        var val = data[f]
        if( _.isObject(val) && val.entity$ ) {
          self[f] = val.id
        }
        else {
          self[f] = val
        }
      }
    }

    return self
  }
  else {
    var include_$ = _.isUndefined(data) ? true : !!data
    data = {}

    if( include_$ ) {
      canonkind = canonkind || 'object'
      var canonformat = {}
      canonformat[canonkind] = true
      data.entity$ = self.canon$(canonformat)
    }

    var fields = self.fields$()
    for( var fI = 0; fI < fields.length; fI++ ) {
      if( !~fields[fI].indexOf('$') ) {

        var val = self[fields[fI]]
        if( _.isObject(val) && val.entity$ ) {
          data[fields[fI]] = val.id
        }
        else {
          data[fields[fI]] = val
        }
      }
    }

    return data
  }
}


Entity.prototype.clone$ = function() {
  var self = this
  var si   = self.private$.seneca

  return self.make$(self.data$())
}


Entity.prototype.toString = function() {
  var self = this
  var si   = self.private$.seneca

  var sb = ['$',self.canon$({string:true}),':{id=',self.id,';']
  var hasp = 0
  var fields = self.fields$()
  fields.sort()
  for( var fI = 0; fI < fields.length; fI++ ) {
    if( 'id' == fields[fI] ) continue;
    hasp = 1
    sb.push(fields[fI])
    sb.push('=')

    var val = self[fields[fI]]
    if( _.isDate(val) ) {
      sb.push( val.toISOString() )
    }
    else if( _.isObject( val ) ) {
      val = util.inspect(val,{depth:3}).replace(/\s+/g,'')
      sb.push( val )
    }
    else sb.push( ''+val );

    sb.push(';')
  }
  sb[sb.length-hasp]='}'

  return sb.join('')
}


Entity.prototype.inspect = Entity.prototype.toString







// parse a canon string: 
// $zone-base-name
// $, zone, base are optional
function parsecanon(str) {
  var out = {}
  
  if( !_.isString(str) ) return out;

  var m = /\$?((\w+|-)\/)?((\w+|-)\/)?(\w+|-)/.exec(str)
  if( m ) {
    var zi = void 0==m[4]?4:2, bi = void 0==m[4]?2:4
    
    out.zone = '-' == m[zi] ? void 0 : m[zi]
    out.base = '-' == m[bi] ? void 0 : m[bi]
    out.name = '-' == m[5] ? void 0 : m[5]
  }
  else throw new Error('invalid entity canon: "'+str+'"');

  return out
}


Entity.parsecanon = parsecanon

exports.Entity = Entity


