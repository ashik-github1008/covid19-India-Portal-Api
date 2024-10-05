const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

let db = null

app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  let jwtToken
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'ashik')
      response.send({jwtToken: jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'ashik', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//get all states//
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM 
  state;`
  const statesArray = await db.all(getStatesQuery)

  const convertdbObjToOutputObj = dbObj => {
    return {
      stateId: dbObj.state_id,
      stateName: dbObj.state_name,
      population: dbObj.population,
    }
  }

  response.send(
    statesArray.map(eachState => convertdbObjToOutputObj(eachState)),
  )
})

//get state based on id//
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT * FROM state
    WHERE state_id = ${stateId};`

  const state = await db.get(getStateQuery)

  const stateRes = {
    stateID: state.state_id,
    stateName: state.state_name,
    population: state.population,
  }
  response.send(stateRes)
})

//create district //
app.post('/districts/', authenticateToken, async (request, response) => {
  const distDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = distDetails
  const addDistQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
  VALUES (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths});`
  const db = await db.run(addDistQuery)
  response.send('District Successfully Added')
})

//get district based on district ID//
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT * FROM district
  WHERE district_id = ${districtId};`

    const dbRes = await db.get(getDistrictQuery)

    const districtRes = {
      districtId: dbRes.district_id,
      districtName: dbRes.district_name,
      stateId: dbRes.state_id,
      cases: dbRes.cases,
      cured: dbRes.cured,
      active: dbRes.active,
      deaths: dbRes.deaths,
    }

    response.send(districtRes)
  },
)

// delete district based on district id //
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `DELETE FROM district
  WHERE district_id = ${districtId};`

    const dbRes = await db.get(getDistrictQuery)
    response.send('District Removed')
  },
)

// update district details based on district id //
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const distDetails = request.body

    const {districtName, stateId, cases, cured, active, deaths} = distDetails
    const updateDistrictQuery = `
    UPDATE
      district
    SET
      district_name='${districtName}',
      state_id=${stateId},
      cases=${cases},
      cured=${cured},
      active=${active},
      deaths='${deaths}'
    WHERE
      district_id = ${districtId};`
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

// state statistics //
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const statsQuery = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM  district INNER JOIN state
  ON state.state_id = district.state_id
  WHERE district.state_id = ${stateId};`

    const stats = await db.get(statsQuery)
    response.send(stats)
  },
)

module.exports = app
