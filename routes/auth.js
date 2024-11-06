import express from "express";
import { neon } from '@neondatabase/serverless';
import validator from "validator";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const sql = neon('postgresql://paltaclick_owner:CzyPKjdGI53A@ep-misty-bonus-a55bawz1.us-east-2.aws.neon.tech/paltaclick?sslmode=require');
const CLAVE = 'aguanteelbulla';
const AUTH_COOKIE_NAME = 'triton';

var router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.cookies[AUTH_COOKIE_NAME];

  try{
    req.user = jwt.verify(token, CLAVE);
    next();
  }catch(e){
    const error = {
      error: 'usuario no autentificado'
    }
    res.json(error, 401)
  }
}

router.post('/register', async function(req, res, next){
  const data = req.body;
  if(data.name != '' && 
    data.lastname != '' &&
    data.address != '' &&
    (data.gender == 'male' || data.gender == 'female' || data.gender == 'other') &&
    data.zipcode != '' &&
    validator.isEmail(data.email) &&
    data.password.length > 8 &&
    data.password2 == data.password
  ){
    const name = data.name;
    const lastname = data.lastname;
    const money = 1000000;
    const is_admin = 0;
    const email = data.email;
    const password = bcrypt.hashSync(data.password, 5);
    const address = data.address;
    const gender = data.gender;
    const zipcode = parseInt(data.zipcode);
    const query = `INSERT INTO users (name, lastname, money, is_admin, email, password, address, gender, zipcode) VALUES ('${name}', '${lastname}', ${money}, '${is_admin}', '${email}', '${password}', '${address}', '${gender}', ${zipcode}) RETURNING id`;
    

    try{
    const result = await sql(query);
    const [{id}] = result;

    const fiveMinuteFromNowInSeconds = Math.floor(Date.now() / 1000) + 5 * 60;
    
    const token = jwt.sign({id, exp: fiveMinuteFromNowInSeconds}, CLAVE );

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure:false,
      sameSite: "lax",
      maxAge: 60*5*1000
    });

    const succesful = {
      succesful: "Succesful Operation"
    }

    res.json(succesful, 302)
    }
    catch(e){
      const error = {
        error: "Correo ya utilizado"
      }

      res.json(error,400)
    }
  }
  else{
    const error = {
      error: "Datos incompletosa"
    }
    res.json(error,400);
  }
});


router.post('/login', async function(req, res, next) {
  const {email, password} = req.body;
  const query = 'SELECT id, password FROM users WHERE email = $1';
  const results = await sql(query, [email]);

  if(results.length === 0){
    const error = {
      error: "unknown"
    }
    res.json(error, 401)
    return;
  }

  const id = results[0].id;
  const hash = results[0].password;

  if(bcrypt.compareSync(password, hash)){
    const fiveMinuteFromNowInSeconds = Math.floor(Date.now() / 1000) + 5 * 60;
    
    const token = jwt.sign({id, exp: fiveMinuteFromNowInSeconds}, CLAVE );

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure:false,
      sameSite: "lax",
      maxAge: 60*5*1000
    });

    const succesful = {
      succesful: "Succesful operation"
    }

    res.json(succesful, 302);
    return;
  }

  const error = {
    error: "unknown"
  }
  res.json(error, 401)
  
});

router.get('/dashboard', authMiddleware, async function(req, res, next) {
  const [{is_admin}] = await sql(`SELECT is_admin FROM users WHERE id = ${req.user.id}`);
  if(is_admin){
    let ingresos = [];
    try{
      const ingresosDia= await sql('SELECT SUM(h.quantity*p.price) FROM history h JOIN products p ON h.id_product = p.id WHERE h.date = CURRENT_DATE');
      const ingresoSemana = await sql(`SELECT SUM(h.quantity*p.price) FROM history h JOIN products p ON h.id_product = p.id WHERE h.date <= current_date AND h.date >= current_date - INTERVAL '7 days'`)
      const ingresoAno = await sql(`SELECT SUM(h.quantity*p.price) FROM history h JOIN products p ON h.id_product = p.id WHERE EXTRACT( YEAR FROM h.date) = (SELECT EXTRACT(YEAR FROM current_date))`);
      const ultimosProductos = await sql(`SELECT h.quantity, p.name FROM history h JOIN products p ON h.id_product = p.id ORDER BY h.date DESC LIMIT 3`);

      ingresos = [[...ingresosDia], [...ingresoSemana], [...ingresoAno], [...ultimosProductos]];

      res.json(ingresos,200);
    }catch(e){
      res.json(ingresos, 404);
    }
    
  }
  else{
    const error = {
      error: 'unknown'
    }
    res.json(error, 401);
  }
});

router.get('/productos', authMiddleware, async function(req, res, next) {
  const [{is_admin}] = await sql(`SELECT is_admin FROM users WHERE id = ${req.user.id}`);
  if(is_admin){
    const products = await sql("SELECT * FROM products");
    res.json(products, 200);
  }
  else{
    const error = {
      error: "no tiene permisos"
    }
    res.json(error, 403);
  }
});


router.post('/crear', authMiddleware, async function(req, res, next) {
  const [{is_admin}] = await sql(`SELECT is_admin FROM users WHERE id = ${req.user.id}`);
  if(is_admin){
  const datos = req.body;
  const claves = Object.keys(datos);

  if(is_admin)
    for(let i=0; i<claves.length; i++){

      if(datos[claves[i]] == ""){
        const error = {
          error: 'llene todos los campos'
        }
        res.json(error, 400);
        return;
      }
    }

    try{
      const {name, price, description, stock, image} = datos;
      const query = "INSERT INTO products (name, price, description, stock, image) VALUES ($1, $2, $3, $4, $5)";
      const result = await sql(query, [name, price, description, stock, image]);

      const succesful = {
        succesful: "datos insertados correctamente"
      }

      res.json(succesful, 201);
      
    }catch(e){
      const error = {
        error: "un error ocurrió con la db"
      }
      res.json(error, 500);
    }
   
  }
  else{
    const error = {
      error: 'no tienes permisos'
    }
    res.json(error, 403);
  }
});


router.get('/editar/:id', authMiddleware , async function(req, res, next) {
  const [{is_admin}] = await sql(`SELECT * FROM users WHERE id = ${req.user.id}`);
  if(is_admin){
    const query = `SELECT * FROM products WHERE id = $1`;

    try{
    const product = await sql(query, [req.params.id]);
    res.json(product, 200);
    }
    catch(e){
    const error = {
      error: 'id no valido'
    }
    res.json(error, 400);
    }
    
  }
  else{
    const error = {
      error: 'no tienes permisos'
    }
    res.json(error, 403);
  }
});

router.post('/editar', authMiddleware, async function(req, res, next) {
  const [{is_admin}] = await sql(`SELECT is_admin FROM users WHERE id = ${req.user.id}`);
  if(is_admin){
  const datos = req.body;
  const claves = Object.keys(datos);

    for(let i=0; i<claves.length; i++){
      console.log(`${claves[i]}: ${datos[claves[i]]}`);

      if(datos[claves[i]] == ""){
        const error = {
          error: 'llene todos los campos'
        }
        res.json(error, 400);
        return;
      }
    }

    try{
      const {id,name, price, description, stock} = datos;
      const query = "UPDATE products SET name=$1, price=$2, description=$3, stock=$4 WHERE id = $5";
      const result = await sql(query, [name, price, description, stock, id]);

      const succesful = {
        succesful: "succesful operation"
      }

      res.json(succesful, 201);
    }catch(e){
      const error = {
        error: "hubo un problema actualizando los datos"
      }
      res.json(error, 400)
    }

  }
  else{
    const error = {
      error: 'no tienes permisos'
    }
    res.json(error, 403);
  }
});


router.get('/pedidos', authMiddleware, async function(req, res, next) {
  const [{is_admin}] = await sql(`SELECT is_admin FROM users WHERE id = ${req.user.id}`);
  if(is_admin){
    try{
    const orders = await sql(`SELECT * FROM history JOiN products ON products.id = history.id_product`);
    res.json(orders, 200);
    }catch(e){
      const error = {
        error : "hubo un error obteniendo los datos"
      }
      res.json(error, 400)
    }
    
  }
  else{
    const error = {
      error: 'no tienes permisos'
    }
    res.json(error, 403);
  }
});

router.post('/eliminar', authMiddleware, async function(req, res){
  const [{is_admin}] = await sql(`SELECT is_admin FROM users WHERE id = ${req.user.id}`);
  if(is_admin){
    try{
    const eliminar = await sql(`DELETE FROM ${req.body.table} WHERE id=${req.body.id}`);
    //const final = await sql(eliminar, [req.body.table, parseInt(req.body.id)]);

    const respuesta = {
      succesful: "producto eliminado correctamente"
    }
    res.json(respuesta, 200);


    }
    catch(e){
      const error = {
        error: "el producto no existe en la base de datos"
      }
      res.json(req.body, 404);
    }
  }

  else{
    const error = {
      error: "No tienes permisos"
    }
    res.json(error, 403);
  }
  
})

router.post('/update', authMiddleware, async function(req, res){
  const datos = req.body;
  
  datos.forEach(async element => {
    try{
      const resultado = await sql(`UPDATE shoppingcart SET quantity = ${element.quantity} WHERE product_id = ${element.id} and user_id = ${res.locals.usuario.id}`);
    }
    catch{
      const error = {
        error: "no se pudieron actualizar todos los productos"
      }
      res.json(error, 500);
      return;
    }
  });

  const succesful = {
    succesful: 'El carrito fue actualizado correctamnente'
  }
  res.json(succesful, 200);
})


router.get('/pay', authMiddleware, async function(req, res){

  try{
    const costoProductos = await sql(`select SUM((products.price*shoppingcart.quantity)) as total FROM products join shoppingcart on products.id = shoppingcart.product_id WHERE shoppingcart.user_id = ${res.locals.usuario.id}`);
    const total = parseInt(costoProductos[0].total);

    if(total <= res.locals.usuario.money){
      try{
        const update = await sql(`UPDATE users SET money = ${res.locals.usuario.money - total} WHERE id = ${res.locals.usuario.id}`);
        const mandarHistorial = await sql(`INSERT INTO history (id_user, id_product, quantity, address, date) SELECT user_id, product_id, quantity, '${res.locals.usuario.address}', current_date FROM shoppingcart WHERE user_id = ${res.locals.usuario.id}`);
        const limpiarCarrito = await sql(`DELETE FROM shoppingcart WHERE user_id = ${res.locals.usuario.id}`);
  
        const succesful = {
          succesful: "pago completo"
        }
        res.json(succesful, 200);
      }
      catch{
        const error = {
          error: "un error ocurrió en el pago"
        }
  
        res.json(error, 500)
      }
    }
    else{
      const error = {
        error: "dinero no suficiente"
      }
      res.json(error, 422)
    } 


  }catch{
    const error = {
      error: "Hubo un problema accediendo a los datos"
    }
    res.json(error, 400);
  }
})


export default router;
