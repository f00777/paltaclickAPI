import express from "express";
import createError from "http-errors";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import {fileURLToPath} from "url";
import {engine} from "express-handlebars";
import jwt from "jsonwebtoken";
import { neon } from '@neondatabase/serverless';
import indexRouter from "./routes/index.js";
import authRouter from "./routes/auth.js";

const app = express();
const CLAVE = 'aguanteelbulla';
const AUTH_COOKIE_NAME = 'triton';
const sql = neon('postgresql://paltaclick_owner:CzyPKjdGI53A@ep-misty-bonus-a55bawz1.us-east-2.aws.neon.tech/paltaclick?sslmode=require');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), 'public')));

app.use(async function(req, res, next){
    if(req.cookies[AUTH_COOKIE_NAME]){
      let user = jwt.verify(req.cookies[AUTH_COOKIE_NAME], CLAVE);
      user = await sql(`SELECT * FROM users WHERE id = ${user.id}`);
      user = user[0];
      res.locals.usuario = user;
      next();
    }
    else{
      next();
    }
  })

app.use('/api', indexRouter);
app.use('/api/auth', authRouter);



export default app;
