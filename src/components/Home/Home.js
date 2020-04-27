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
import alphaMapTexture from '../../static/img/alpha-map.png'
import lightMapTexture from '../../static/img/light-map.png'
import emissiveMapTexture from '../../static/img/emissive-map.png'
import aoMapTexture from '../../static/img/ao-map.png'
import bumpMapTexture from '../../static/img/bump-map.png'
import normalMapTexture from '../../static/img/normal-map.png'

// THREE
let scene, camera, renderer, controls
const mouse = new THREE.Vector2(), raycaster = new THREE.Raycaster()

// CANNON
let world, lastTime, roomMaterial, balloonMaterial

// Mixed
let balloons = [], room, cannonDebugRenderer, resizeTimer

// UI
let streamDelay = 0

// Stats.js
let stats

class Home extends React.Component {

  constructor(props) {
    super(props)

    this.gravityX = 0
    this.gravityY = -0.5
    this.gravityZ = 0
    this.gazForce = 3.13
    this.rotateGravity = false
    this.streamBalloons = false
    this.rotate = false
    this.rotateSpeed = 0.01
    this.rotateGravitySpeed = 0.001
    this.rotateGravityAmplitude = 1
    this.debug = false
    this.explosionForce = 1
    this.canExplodeBalloons = false
    this.color = '#ffbcbc'
    this.emissive = '#d44aff'
    this.groundConstraint = false
    this.balloonGetString = true

    this.canvas = React.createRef()
    this.animate = this.animate.bind(this)
    this.handleClick = this.handleClick.bind(this)
    this.handleResize = this.handleResize.bind(this)
  }

  componentDidMount() {
    this.init()
    this.animate()

    window.addEventListener('resize', this.handleResize)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize)
  }

  init() {
    // THREE

    renderer = new THREE.WebGLRenderer({antialias: true, canvas: this.canvas})
    renderer.setSize(innerWidth, innerHeight)
    renderer.setPixelRatio(devicePixelRatio)
    renderer.shadowMap.enabled = true

    scene = new THREE.Scene()

    this.cubeTexture = new THREE.CubeTextureLoader()
      .load([px, nx, py, ny, pz, nz])

    this.alphaMapTexture = new THREE.TextureLoader()
      .load(alphaMapTexture)

    this.lightMapTexture = new THREE.TextureLoader()
      .load(lightMapTexture)

    this.emissiveMapTexture = new THREE.TextureLoader()
      .load(emissiveMapTexture)

    this.aoMapTexture = new THREE.TextureLoader()
      .load(aoMapTexture)

    this.bumpMapTexture = new THREE.TextureLoader()
      .load(bumpMapTexture, texture => {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(1, 1)
      })

    this.normalMapTexture = new THREE.TextureLoader()
      .load(normalMapTexture, texture => {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(2.6, 2.8)
      })

    this.balloonMat = new THREE.MeshPhongMaterial({
      color: this.color,
      emissive: this.emissive,
      emissiveIntensity: .6,
      aoMap: this.aoMapTexture,
      aoMapIntensity: 1,
      bumpMap: this.bumpMapTexture,
      normalMap: this.normalMapTexture,
      lightMap: this.lightMapTexture,
      lightMapIntensity: 1,
      transparent: true,
      envMap: this.cubeTexture,
      combine: THREE.MultiplyOperation,
      reflectivity: .6,
    })

    this.ambientLight = new THREE.AmbientLight(0xffffff, .38)
    scene.add(this.ambientLight)
    
    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .01, 1000)
    camera.position.set(0, 0, 2)
    controls = new OrbitControls(camera, this.canvas)
    controls.enabled = true

    // CANNON

    world = new CANNON.World()
    world.broadphase = new CANNON.NaiveBroadphase()
    world.gravity.set(0, this.gravityY, 0)

    cannonDebugRenderer = new CannonDebugRenderer(scene, world)
    
    this.addRoom()
    this.addMaterials()
    this.addGUI()

    // Stats.js
    stats = new Stats()
    document.body.appendChild(stats.domElement)
  }

  addGUI() {
    // Dat.gui
    const gui = new dat.GUI()
    gui.add(this, 'debug')

    // const lightFolder = gui.addFolder('light')
    // lightFolder.add(this.pointLight, 'intensity', 0, 2).name('point')
    // lightFolder.add(this.ambientLight, 'intensity', 0, 2).name('ambient')
    
    const gravityFolder = gui.addFolder('gravity')
    gravityFolder.add(this, 'gravityX', -10, 10).step(.1).listen()
    gravityFolder.add(this, 'gravityY', -10, 10).step(.1).listen()
    gravityFolder.add(this, 'gravityZ', -10, 10).step(.1).listen()
    gravityFolder.add(this, 'rotateGravity').name('auto rotate')
    gravityFolder.add(this, 'rotateGravitySpeed', 0.0001, 0.005).name('speed')
    gravityFolder.add(this, 'rotateGravityAmplitude', 1, 10).name('amplitude')
    // gravityFolder.open()

    const balloonsFolder = gui.addFolder('ballons')
    balloonsFolder.add(this, 'streamBalloons').name('stream balloons')
    balloonsFolder.add(this, 'addBalloon')
    balloonsFolder.add(this, 'resetBalloon').name('reset')
    balloonsFolder.add(this, 'groundConstraint').name('attach balloon')
    balloonsFolder.add(this, 'canExplodeBalloons').name('explode click')
    balloonsFolder.add(this, 'explosionForce', 1, 8).name('explosion force')
    balloonsFolder.add(this, 'gazForce', 0, 10).name('gaz force')
    balloonsFolder.add(this, 'balloonGetString').name('string')
    // boxesFolder.add(this.balloonMat, 'shininess', 0, 30)

    balloonsFolder.add(this.balloonMat, 'opacity', 0, 1)
    balloonsFolder.add(this.balloonMat, 'reflectivity', 0, 1)
    balloonsFolder.add(this.balloonMat, 'emissiveIntensity', 0, 1)
    balloonsFolder.add(this.balloonMat, 'aoMapIntensity', 0, 1)
    balloonsFolder.add(this.balloonMat, 'lightMapIntensity', 0, 1)
    balloonsFolder.open()

    const normalFolder = balloonsFolder.addFolder('normal map')
    normalFolder.add(this.balloonMat.normalMap.repeat, 'x', 0, 10).name('repeat y').listen()
    normalFolder.add(this.balloonMat.normalMap.repeat, 'y', 0, 10).name('repeat x').listen()

    normalFolder.add(this.balloonMat.normalScale, 'x', 0, 10).name('scale x')
    normalFolder.add(this.balloonMat.normalScale, 'y', 0, 10).name('scale y')
    // normalFolder.open()

    const colorsFolder = gui.addFolder('colors')
    colorsFolder.addColor(this, 'color').onChange(() => {
      this.balloonMat.color = new THREE.Color(this.color)
      this.balloonMat.needsUpdate = true
    })
    colorsFolder.addColor(this, 'emissive').onChange(() => {
      this.balloonMat.emissive = new THREE.Color(this.emissive)
      this.balloonMat.needsUpdate = true
    })
    // colorsFolder.open()
    
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

    const adjacent = camera.position.z
    const hypothenuse = adjacent / Math.cos(camera.fov / 2 * Math.PI / 180)
    const opposite = Math.sqrt(Math.pow(hypothenuse, 2) - Math.pow(adjacent, 2))
    const height = opposite * 2
    const width = height * camera.aspect
    this.roomWidth = width

    const planeGeom = new THREE.PlaneBufferGeometry(width, height)
    const planeGeom2 = new THREE.PlaneBufferGeometry(width, width)
    const planeMat = new THREE.MeshPhongMaterial({color: 0xffffff})
    room = new THREE.Object3D()
    scene.add(room)

    const back = new THREE.Mesh(planeGeom, planeMat)
    back.position.z = -width
    back.receiveShadow = true
    room.add(back)

    const front = new THREE.Mesh(planeGeom, planeMat)
    front.rotation.y = Math.PI
    front.receiveShadow = true
    room.add(front)

    const left = new THREE.Mesh(planeGeom, planeMat)
    left.position.z = -width / 2
    left.position.x = -width / 2
    left.rotation.y = Math.PI / 2
    left.receiveShadow = true
    room.add(left)

    const right = new THREE.Mesh(planeGeom, planeMat)
    right.position.z = -width / 2
    right.position.x = width / 2
    right.rotation.y = -Math.PI / 2
    right.receiveShadow = true
    room.add(right)

    // const top = new THREE.Mesh(planeGeom2, planeMat)
    // top.position.z = -width / 2
    // top.position.y = height / 2
    // top.rotation.x = Math.PI / 2
    // top.receiveShadow = true
    // room.add(top)

    const rectLight = new THREE.RectAreaLight(0xffffff, 3, width, width)
    rectLight.position.set(0, height/2, -width/2)
    rectLight.lookAt(0, 0, -width/2)
    room.add(rectLight)
    const rectLightHelper = new THREE.RectAreaLightHelper(rectLight)
    rectLight.add(rectLightHelper)

    this.pointLight = new THREE.PointLight(0xffffff, .35)
    this.pointLight.position.set(0, 0, -width/2)
    scene.add(this.pointLight)

    const bottom = new THREE.Mesh(planeGeom2, planeMat)
    bottom.position.z = -width / 2
    bottom.position.y = -height / 2
    bottom.rotation.x = -Math.PI / 2
    bottom.receiveShadow = true
    room.add(bottom)

    const shape = new CANNON.Plane()

    const bottomBody = new CANNON.Body({mass: 0, material: roomMaterial})
    bottomBody.addShape(shape)
    bottomBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    bottomBody.position.set(0, -height/2, 0)
    this.groundBody = bottomBody

    const topBody = new CANNON.Body({mass: 0, material: roomMaterial})
    topBody.addShape(shape)
    topBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)
    topBody.position.set(0, height/2, 0)

    const leftBody = new CANNON.Body({mass: 0, material: roomMaterial})
    leftBody.addShape(shape)
    leftBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2)
    leftBody.position.set(-width/2, 0, 0)

    const rightBody = new CANNON.Body({mass: 0, material: roomMaterial})
    rightBody.addShape(shape)
    rightBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2)
    rightBody.position.set(width/2, 0, 0)

    const frontBody = new CANNON.Body({mass: 0, material: roomMaterial})
    frontBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI)
    frontBody.addShape(shape)

    const backBody = new CANNON.Body({mass: 0, material: roomMaterial})
    backBody.addShape(shape)
    backBody.position.set(0, 0, -width)

    room.bodies = [bottomBody, topBody, leftBody, rightBody, frontBody, backBody]

    world.add(bottomBody)
    world.add(topBody)
    world.add(leftBody)
    world.add(rightBody)
    world.add(frontBody)
    world.add(backBody)
  }

  addMaterials() {
    roomMaterial = new CANNON.Material('roomMaterial')
    balloonMaterial = new CANNON.Material('balloonMaterial')

    const roomBalloonContactMaterial = new CANNON.ContactMaterial(roomMaterial, balloonMaterial, {
      friction: 0.001,
      restitution: .2
    })
    const balloonBalloonContactMaterial = new CANNON.ContactMaterial(balloonMaterial, balloonMaterial, {
      friction: 0.01,
      restitution: .8
    })

    world.addContactMaterial(roomBalloonContactMaterial)
    world.addContactMaterial(balloonBalloonContactMaterial)
  }

  addBalloon() {
    const height = .8
    const minRadius = 0
    const maxRadius = .4
    const zPos = -this.roomWidth/2

    const p1 = new THREE.Vector2(minRadius, 0)
    const p2 = new THREE.Vector3(maxRadius, height/2)
    const p3 = new THREE.Vector3(maxRadius, height)
    const p4 = new THREE.Vector3(minRadius, height)

    const curve = new THREE.CubicBezierCurve(p1, p2, p3, p4)
    const curvePoints = curve.getPoints(20)

    const obj = new THREE.Object3D()
    const geo = new THREE.LatheBufferGeometry(curvePoints, 50)
    geo.translate(0, -height/2 - .1, 0)
    geo.attributes.uv2 = geo.attributes.uv

    const mesh = new THREE.Mesh(geo, this.balloonMat)
    mesh.isBalloon = true
    obj.add(mesh)
    scene.add(obj)

    const body = new CANNON.Body({mass: 1, material: balloonMaterial})
    const sphereShape = new CANNON.Sphere(maxRadius * .8)
    // body.addShape(sphereShape, new CANNON.Vec3(0, height / 1.6, 0))
    body.addShape(sphereShape)

    const cylinderShape = new CANNON.Cylinder(.01, .2, .4, 10)
    const quaternion = new CANNON.Quaternion()
    quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI/2)
    // body.addShape(cylinderShape, new CANNON.Vec3(0, .2, 0), quaternion)
    body.addShape(cylinderShape, new CANNON.Vec3(0, -.3, 0), quaternion)
    // body.angularDamping = .9
    
    body.position.set(0, 0, zPos)
    world.add(body)

    if (this.balloonGetString) {

      // String

      const slices = 20
      const segments = 3
      const strHeight = .6

      const strGeo = new THREE.CylinderBufferGeometry(.005, .005, strHeight, segments, slices, true)
      const strMat = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: false })
      const strMesh = new THREE.Mesh(strGeo, strMat)
      obj.add(strMesh)
      
      const particles = []
      const particleHeight = strHeight / slices

      for (let i = 0; i <= slices; i++) {
        const particle = new CANNON.Body({mass: .01 })
        particle.addShape(new CANNON.Particle())
        particle.position.set(0, i * -particleHeight, zPos)
        // particle.linearDamping = .05
        // particle.angularDamping = .05
        world.add(particle)
        particles.push(particle)
      }

      const balloonConstraint = new CANNON.PointToPointConstraint(
        body, 
        new CANNON.Vec3(0, -height / 2 - .1, 0), 
        particles[0], 
        new CANNON.Vec3(0, 0, 0)
      )

      world.addConstraint(balloonConstraint)

      particles.forEach((particle, index) => {
        if (index < particles.length - 1) {
          const constraint = new CANNON.PointToPointConstraint(
            particle, 
            new CANNON.Vec3(0, -particleHeight, 0),
            particles[index + 1],
            new CANNON.Vec3(0, particleHeight, 0)
          )
          world.addConstraint(constraint)
        }
      })

      if (this.groundConstraint) {
        const groundConstraint = new CANNON.PointToPointConstraint(
          this.groundBody, 
          new CANNON.Vec3(0, this.roomWidth / 2, 0), 
          particles[particles.length - 1],
          new CANNON.Vec3()
        )
        world.addConstraint(groundConstraint)
      }

      mesh.particles = particles
      mesh.strMesh = strMesh
    }

    // const balloonConstraint = new CANNON.DistanceConstraint(body, particles[0], 0)
    // world.addConstraint(balloonConstraint)

    // if (this.groundConstraint) {
    //   const groundConstraint = new CANNON.PointToPointConstraint(
    //     this.groundBody, 
    //     new CANNON.Vec3(0, this.roomWidth / 2, 0), 
    //     particles[particles.length - 1],
    //     new CANNON.Vec3()
    //   )
    //   world.addConstraint(groundConstraint)
    // }
    
    // particles.forEach((particle, index) => {
    //   if (index < particles.length - 1) {
    //     const constraint = new CANNON.DistanceConstraint(particle, particles[index + 1], strHeight / slices)
    //     world.addConstraint(constraint)
    //   }
    // })
    
    mesh.body = body

    balloons.push(mesh)
  }

  resetBalloon() {
    balloons.forEach(balloon => {
      scene.remove(balloon.parent)
      world.remove(balloon.body)

      if (balloon.particles) {
        balloon.particles.forEach(particle => {
          world.remove(particle)
        })
      }
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
    if (this.streamBalloons) {
      if (!streamDelay) {
        this.addBalloon()
        streamDelay = 10
      } else {
        streamDelay--
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

    // if (room) {
    //   room.position.copy(room.body.position)
    //   room.quaternion.copy(room.body.quaternion)
    // }
    
    world.gravity.set(this.gravityX, this.gravityY, this.gravityZ)
    const force = new CANNON.Vec3(0, this.gazForce, 0)

    balloons.forEach(balloon => {
      const point = new CANNON.Vec3()
      balloon.body.pointToWorldFrame(new CANNON.Vec3(0, .5, 0), point)
      balloon.body.applyForce(force, point)

      balloon.position.copy(balloon.body.position)
      balloon.quaternion.copy(balloon.body.quaternion)

      if (balloon.particles) {
        const positions = balloon.strMesh.geometry.attributes.position.array

        balloon.particles.forEach((particle, index) => {
          const { x, y, z } = particle.position

          positions[index * 4 * 3] = x // x1
          positions[index * 4 * 3 + 1] = y // y1
          positions[index * 4 * 3 + 2] = z + 0.005 // z1

          positions[index * 4 * 3 + 3] = x + 0.004 // x2
          positions[index * 4 * 3 + 4] = y // y2
          positions[index * 4 * 3 + 5] = z - 0.0025 // z2

          positions[index * 4 * 3 + 6] = x - 0.004 // x3
          positions[index * 4 * 3 + 7] = y // y3
          positions[index * 4 * 3 + 8] = z  - 0.0025// z3

          positions[index * 4 * 3 + 9] = x // x1
          positions[index * 4 * 3 + 10] = y // y1
          positions[index * 4 * 3 + 11] = z + 0.005 // z1
        })

        balloon.strMesh.geometry.attributes.position.needsUpdate = true
      }
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

  handleClick(e) {
    e.preventDefault()

    if (this.canExplodeBalloons) {
      mouse.x = (e.clientX / innerWidth) * 2 - 1
      mouse.y = - (e.clientY / innerHeight) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      const intersects = raycaster.intersectObjects(balloons)
      let explodedBalloonPosition

      for (let i = 0; i < intersects.length; i++) {
        const child = intersects[i]
        const mesh = child.object

        if (mesh.isBalloon) {
          scene.remove(mesh.parent)
          world.remove(mesh.body)
          const index = balloons.indexOf(mesh)
          balloons.splice(index, 1)
          explodedBalloonPosition = child.point
          break
        }
      }

      if (explodedBalloonPosition) {
        balloons.forEach(mesh => {
          const dir = mesh.position.sub(explodedBalloonPosition)
          const final = dir.normalize().multiplyScalar(this.explosionForce)

          const impulse = new CANNON.Vec3(final.x, final.y, final.z)
          const worldPoint = new CANNON.Vec3(explodedBalloonPosition.x, explodedBalloonPosition.y, explodedBalloonPosition.z)
    
          mesh.body.applyImpulse(impulse, worldPoint)
        })
      }
    }
  }

  handleResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {

      renderer.setSize(innerWidth, innerHeight)
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()

      scene.remove(room)
      scene.remove(this.pointLight)
      room.bodies.forEach(body => {
        world.remove(body)
      })
      this.addRoom()
    }, 20)
  }

  render() {
    return (
      <div className={styles.container}>
        <canvas ref={el => { this.canvas = el }} onClick={this.handleClick}/>
      </div>
    )
  }
}

export default Home;