import React from 'react'
import styles from './Home.css'
import * as THREE from 'three'
import * as CANNON from 'cannon'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import CannonDebugRenderer from './../../utils/CannonDebugRenderer'
import Stats from 'stats.js'
import dat from 'dat.gui'
import px from '../../static/img/cubemap/px.jpg'
import nx from '../../static/img/cubemap/nx.jpg'
import py from '../../static/img/cubemap/py.jpg'
import ny from '../../static/img/cubemap/ny.jpg'
import pz from '../../static/img/cubemap/pz.jpg'
import nz from '../../static/img/cubemap/nz.jpg'

// THREE
let scene, camera, renderer, controls

// CANNON
let world, lastTime, roomMaterial, balloonMaterial

// Mixed
let balloons = [], room, cannonDebugRenderer

// UI
let cubeDelay = 0

// Stats.js
let stats

class Home extends React.Component {

  constructor(props) {
    super(props)

    this.gravityX = 0
    this.gravityY = .5
    this.rotateGravity = false
    this.hasToAddBalloon = false
    this.rotate = false
    this.rotateSpeed = 0.01
    this.rotateGravitySpeed = 0.001
    this.rotateGravityAmplitude = 1
    this.debug = false

    this.canvas = React.createRef()
    this.animate = this.animate.bind(this)
  }

  componentDidMount() {
    this.init()
    this.animate()
  }

  init() {
    // THREE

    renderer = new THREE.WebGLRenderer({antialias: true, canvas: this.canvas})
    renderer.setSize(innerWidth, innerHeight)
    renderer.setPixelRatio(devicePixelRatio)

    scene = new THREE.Scene()

    this.balloonMat = new THREE.MeshStandardMaterial({
      color: 0xff0000, 
      emissive: 0x480000, 
      roughness: .25, 
      metalness: 0, 
      opacity: .9, 
      transparent: true,
      // envMap: this.cubeTexture
    })

    this.cubeTexture = new THREE.CubeTextureLoader()
      .load([px, nx, py, ny, pz, nz], () => {
        // cubeMat.envMap = this.cubeTexture
        // cubeMat.needsUpdate = true
        console.log(this.cubeTexture)
      })

    this.cubeTexture.encoding = THREE.sRGBEncoding
    // this.cubeTexture.minFilter = THREE.NearestFilter
    // this.cubeTexture.magFilter = THREE.NearestFilter

    const cubeGeo = new THREE.BoxGeometry(1, 1, 1)
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0,
      roughness: 0,
      envMap: this.cubeTexture,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide
    })
    const cube = new THREE.Mesh(cubeGeo, cubeMat)
    scene.add(cube)
    cube.position.set(0, 0, -2)

    // scene.background = this.cubeTexture

    const ambientLight = new THREE.AmbientLight(0xffffff, .1)
    scene.add(ambientLight)
    
    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 1000)
    camera.position.set(0, 0, 2)
    controls = new OrbitControls(camera, this.canvas)
    controls.enabled = true

    scene.add(new THREE.AxesHelper())

    // CANNON

    world = new CANNON.World()
    world.broadphase = new CANNON.NaiveBroadphase()
    world.gravity.set(0, 1, 0)

    cannonDebugRenderer = new CannonDebugRenderer(scene, world)
    
    this.addRoom()

    // Stats.js
    stats = new Stats()
    document.body.appendChild(stats.domElement)

    // Dat.gui
    const gui = new dat.GUI()
    gui.add(this, 'debug')

    const lightFolder = gui.addFolder('light')
    lightFolder.add(this.pointLight, 'intensity', 0, 2)
    
    const gravityFolder = gui.addFolder('gravity')
    gravityFolder.add(this, 'gravityX', -10, 10).step(.1).listen()
    gravityFolder.add(this, 'gravityY', -10, 10).step(.1).listen()
    gravityFolder.add(this, 'rotateGravity').name('auto rotate')
    gravityFolder.add(this, 'rotateGravitySpeed', 0.0001, 0.005).name('speed')
    gravityFolder.add(this, 'rotateGravityAmplitude', 1, 10).name('amplitude')
    // gravityFolder.open()

    const boxesFolder = gui.addFolder('ballons')
    boxesFolder.add(this, 'hasToAddBalloon').name('stream balloons')
    boxesFolder.add(this, 'addBalloon')
    boxesFolder.add(this, 'resetBalloon').name('reset')
    boxesFolder.add(this.balloonMat, 'roughness', 0, 1)
    boxesFolder.add(this.balloonMat, 'metalness', 0, 1)
    // boxesFolder.add(this.balloonMat, 'shininess', 0, 30)
    
    boxesFolder.add(this.balloonMat, 'opacity', 0, 1)
    boxesFolder.open()
    
    const controlsFolder = gui.addFolder('controls')
    controlsFolder.add(controls, 'enabled')
    controlsFolder.add(controls, 'reset')
    // controlsFolder.open()

    const roomFolder = gui.addFolder('room')
    roomFolder.add(this, 'rotate')
    roomFolder.add(this, 'reset')
    roomFolder.add(this, 'rotateSpeed', -.1, .1).step(.01).name('speed')
    // roomFolder.open()
  }

  addRoom() {
    roomMaterial = new CANNON.Material('roomMaterial')
    balloonMaterial = new CANNON.Material('balloonMaterial')

    const roomBalloonContactMaterial = new CANNON.ContactMaterial(roomMaterial, balloonMaterial, {
      friction: 0.1,
      restitution: .8
    })
    const balloonBalloonContactMaterial = new CANNON.ContactMaterial(balloonMaterial, balloonMaterial, {
      friction: 0.2,
      restitution: .8
    })

    world.addContactMaterial(roomBalloonContactMaterial)
    world.addContactMaterial(balloonBalloonContactMaterial)

    const adjacent = camera.position.z
    const hypothenuse = adjacent / Math.cos(camera.fov / 2 * Math.PI / 180)
    const opposite = Math.sqrt(Math.pow(hypothenuse, 2) - Math.pow(adjacent, 2))
    const height = opposite * 2
    const width = height * camera.aspect

    const planeGeom = new THREE.PlaneBufferGeometry(width, height)
    const planeGeom2 = new THREE.PlaneBufferGeometry(width, width)
    const planeMat = new THREE.MeshPhongMaterial({color: 0xffffff})
    room = new THREE.Object3D()
    scene.add(room)

    const back = new THREE.Mesh(planeGeom, planeMat)
    back.position.z = -width
    room.add(back)

    const front = new THREE.Mesh(planeGeom, planeMat)
    front.rotation.y = Math.PI
    room.add(front)

    const left = new THREE.Mesh(planeGeom, planeMat)
    left.position.z = -width / 2
    left.position.x = -width / 2
    left.rotation.y = Math.PI / 2
    room.add(left)

    const right = new THREE.Mesh(planeGeom, planeMat)
    right.position.z = -width / 2
    right.position.x = width / 2
    right.rotation.y = -Math.PI / 2
    room.add(right)

    const top = new THREE.Mesh(planeGeom2, planeMat)
    top.position.z = -width / 2
    top.position.y = height / 2
    top.rotation.x = Math.PI / 2
    // room.add(top)

    const rectLight = new THREE.RectAreaLight(0xffffff, 3, width, width)
    rectLight.position.set(0, height/2, -width/2)
    room.add(rectLight)
    rectLight.lookAt(0, 0, -width/2)

    const rectLightHelper = new THREE.RectAreaLightHelper(rectLight)
    rectLight.add(rectLightHelper)

    this.pointLight = new THREE.PointLight(0xffffff, .7)
    this.pointLight.position.set(0, 0, -width/2)
    scene.add(this.pointLight)

    const bottom = new THREE.Mesh(planeGeom2, planeMat)
    bottom.position.z = -width / 2
    bottom.position.y = -height / 2
    bottom.rotation.x = -Math.PI / 2
    room.add(bottom)

    const body = new CANNON.Body({mass: 0, material: roomMaterial})
    const shape = new CANNON.Plane()

    const bottomQuaternion = new CANNON.Quaternion()
    bottomQuaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    body.addShape(shape, new CANNON.Vec3(0, -height/2, 0), bottomQuaternion)

    const topQuaternion = new CANNON.Quaternion()
    topQuaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)
    body.addShape(shape, new CANNON.Vec3(0, height/2, 0), topQuaternion)

    const leftQuaternion = new CANNON.Quaternion()
    leftQuaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2)
    body.addShape(shape, new CANNON.Vec3(-width/2, 0, 0), leftQuaternion)

    const rigthQuaternion = new CANNON.Quaternion()
    rigthQuaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2)
    body.addShape(shape, new CANNON.Vec3(width/2, 0, 0), rigthQuaternion)

    const frontQuaternion = new CANNON.Quaternion()
    frontQuaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI)
    body.addShape(shape, new CANNON.Vec3(), frontQuaternion)

    body.addShape(shape, new CANNON.Vec3(0, 0, -width))

    room.body = body
    world.add(room.body)
  }

  addBalloon() {
    const height = .8
    const minRadius = 0
    const maxRadius = .4

    const p1 = new THREE.Vector2(minRadius, 0)
    const p2 = new THREE.Vector3(maxRadius, height/2)
    const p3 = new THREE.Vector3(maxRadius, height)
    const p4 = new THREE.Vector3(minRadius, height)

    const curve = new THREE.CubicBezierCurve(p1, p2, p3, p4)
    const curvePoints = curve.getPoints(10)

    const obj = new THREE.Object3D()
    const geo = new THREE.LatheGeometry(curvePoints, 20)
    const mesh = new THREE.Mesh(geo, this.balloonMat)
    obj.add(mesh)
    scene.add(obj)

    const body = new CANNON.Body({mass: .01, material: balloonMaterial, angularDamping: 0.1})
    const sphereShape = new CANNON.Sphere(maxRadius * .8)
    body.addShape(sphereShape, new CANNON.Vec3(0, height / 1.6, 0))

    const cylinderShape = new CANNON.Cylinder(.01, .2, .4, 10)
    const quaternion = new CANNON.Quaternion()
    quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI/2)
    body.addShape(cylinderShape, new CANNON.Vec3(0, .2, 0), quaternion)

    // const shape = new CANNON.ConvexPolyhedron(points, faces)
    body.position.set(0, 0, -2)
    world.add(body)
    
    obj.body = body
    balloons.push(obj)
  }

  resetBalloon() {
    balloons.forEach(balloon => {
      scene.remove(balloon)
      world.remove(balloon.body)
    })

    balloons = []
  }

  animate(time) {
    requestAnimationFrame(this.animate)
    
    stats.begin()
    this.update(time)

    renderer.render(scene, camera)
    stats.end()
  }

  update(time) {
    if (this.hasToAddBalloon) {
      if (!cubeDelay) {
        this.addBalloon()
        cubeDelay = 10
      } else {
        cubeDelay--
      }
    }

    if (this.rotate) {
      const axisAngle = room.body.quaternion.toAxisAngle()
      let rotateY = axisAngle[1] + this.rotateSpeed
      if (rotateY >= 2 * Math.PI) {
        rotateY = 0
      }

      // console.log(axisAngle)
      room.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotateY)
    }

    if (this.rotateGravity) {
      this.gravityX = Math.cos(time * this.rotateGravitySpeed) * this.rotateGravityAmplitude
      this.gravityY = Math.sin(time * this.rotateGravitySpeed) * this.rotateGravityAmplitude
    }

    if (room) {
      room.position.copy(room.body.position)
      room.quaternion.copy(room.body.quaternion)
    }

    world.gravity.set(this.gravityX, this.gravityY, 0)

    balloons.forEach(obj => {
      obj.position.copy(obj.body.position)
      obj.quaternion.copy(obj.body.quaternion)
    })

    if (this.debug) {
      cannonDebugRenderer.update()
    }

    controls.update()

    const dt = (time - lastTime) / 1000
    world.step(1/60, dt, 3)
    lastTime = time
  }

  reset() {
    room.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 0), 0)
  }

  render() {
    return (
      <div className={styles.container}>
        <canvas ref={el => { this.canvas = el }}/>
      </div>
    )
  }
}

export default Home;