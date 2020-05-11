// Copyright 2018-2020  Entropy Labs Ltd. (HK)
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

class BasicKVStore {
  constructor() {
    this.version = 0
    this.versions = new Map([[0, []]])
    this.store = new Map()
    this.changes = new Map()
    this.changed = new Set()
  }

  set(k, v) {
    this.changes.set(k, v === null ? undefined : v)
    this.changed.add(k)
  }

  get(k) {
    return this.changes.get(k)
  }

  commit() {
    if (!this.changed.size) {
      return false
    }
    
    let log = []
    this.changed.forEach((k) => {
      let v = this.changes.get(k)
      let p = this.store.get(k)
      if (v !== p) {
        if (v === undefined)
          this.store.delete(k)
        else
          this.store.set(k, v)
        log.push([k, p, v])
      }
    })
    this.changed.clear()
    this.versions.set(++this.version, log)
    return true
  }

  reset() {
    if (!this.changed.size) {
      return false
    }
    
    this.changed.forEach((k) => {
      let v = this.store.get(k)
      if (v === undefined)
        this.changes.delete(k)
      else
        this.changes.set(k, v)
    })
    this.changed = new Set()
    
    return true
  }

  revert() {
    this.reset()
    if (!this.versions.get(this.version - 1)) { return false }
    this.versions.get(this.version).forEach((log) => {
      let v = log[1]
      if (v === undefined) {
        this.store.delete(log[0])
        this.changes.delete(log[0])
      } else {
        this.store.set(log[0], log[1])
        this.changes.set(log[0], log[1])
      }
    })
    this.versions.delete(this.version--)
    return true
  }
  
  // a more space-efficient version of commit
  finalize() {
    if (this.versions.size < 2) { return false }
    this.commit()
    let changes = this.versions.get(this.version)
    this.versions = new Map([[0, []]])
    return changes
  }
}

class BasicKVStoreObserver extends BasicKVStore {
  constructor() {
    super()
    this.observers = new Set()
  }
  
  commit() {
    if (super.commit()) {
      if (this.observers.size) {
        let version = this.version      
        let changes = this.versions.get(version)
        this.observers.forEach((f) => {
          if (!f('commit', version, changes)) { this.observers.delete(f) }
        })
      }
      return true
    }
    return false
  }

  reset() {
    if (super.reset()) {
      if (this.observers.size) {
        let version = this.version
        this.observers.forEach((f) => {
          if (!f('reset', version)) { this.observers.delete(f) }
        })
      }
      return true
    }
    return false
  }

  revert() {
    if (super.revert()) {
      if (this.observers.size) { 
        let version = this.version
        this.observers.forEach((f) => {
          if (!f('revert', version)) { this.observers.delete(fn) }
        })
      }
      return true
    }
    return false
  }
  
  finalize() {
    if (super.finalize()) {
      if (this.observers.size) { 
        let version = this.version
        this.observers.forEach((f) => {
          if (!f('finalize', version, changes)) { this.observers.delete(fn) }
        })
      }
      return true
    }
    return false
  }
}

module.exports = BasicKVStore