import express from "express";
import { neon } from '@neondatabase/serverless';
import jwt from "jsonwebtoken";
import validator from "validator";

const sql = neon('postgresql://paltaclick_owner:CzyPKjdGI53A@ep-misty-bonus-a55bawz1.us-east-2.aws.neon.tech/paltaclick?sslmode=require');
const router = express.Router();

const CLAVE = 'aguanteelbulla';
const AUTH_COOKIE_NAME = 'triton';

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

/* GET home page. */
router.get('/', async (req, res) => {
  const products = await sql("SELECT * FROM products ORDER BY id DESC LIMIT 3");
  res.json(products, 200);
});

router.get('/catalogo', async function(req, res, next) {
  const products = await sql("SELECT * FROM products");
  res.json(products, 200);
});

router.get('/producto/:id', async function(req, res, next) {
  const id = req.params.id;
  const query = "SELECT * FROM products WHERE id = $1"
  

  try{
    const product = await sql(query, [id]);
    res.json(product, 200);

  }catch(e){
    const error = {
      error: 'producto no encontrado'
    }
    res.json(error, 404);
  }
});


router.get('/cart', authMiddleware, async function(req, res, next) {

  req.user = jwt.verify(req.cookies[AUTH_COOKIE_NAME], CLAVE);

  if(req.query.id && req.query.quantity && validator.isNumeric(req.query.id) && validator.isNumeric(req.query.quantity)){
    try{
    const query = `INSERT INTO shoppingcart (user_id, product_id, quantity) values ($1, $2, $3)`;
    const resultado = await sql(query, [req.user.id, req.query.id, req.query.quantity]);
    }
    catch(e){
      console.log(e);
    }
  }

  const products = await sql("SELECT products.*, quantity FROM shoppingcart JOIN products ON products.id = shoppingcart.product_id");
  
  res.json(products)
});

router.get('/historial', authMiddleware, async function(req, res, next) {

  const orders = await sql(`SELECT * FROM history JOiN products ON products.id = history.id_product WHERE id_user = ${res.locals.usuario.id}`);
  const total = await sql(`SELECT SUM(products.price*history.quantity) FROM history join products on products.id = history.id_product WHERE history.id_user = ${res.locals.usuario.id}`);

  orders.push(total);

  res.json(orders)
});

export default router;
