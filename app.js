import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { assert } from 'superstruct';
import {
  CreateUser,
  PatchUser,
  CreateProduct,
  PatchProduct,
  CreateOrder,
  PatchOrder,
  PostSavedProduct,
} from './structs.js';
import cors from 'cors';



const prisma = new PrismaClient();

const app = express();
app.use(express.json());
app.use(cors());

function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      if (
        e.name === 'StructError' ||
        e instanceof Prisma.PrismaClientValidationError
      ) {
        res.status(400).send({ message: e.message });
      } else if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        res.sendStatus(404);
      } else {
        res.status(500).send({ message: e.message });
      }
    }
  };
}

/*********** users ***********/

app.get('/users', asyncHandler(async (req, res) => {
  const { offset = 0, limit = 10, order = 'newest' } = req.query;
  let orderBy;
  switch (order) {
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
  }
  const users = await prisma.user.findMany({
    orderBy,
    skip: parseInt(offset),
    take: parseInt(limit),
    include:{
      userPreference: {
        select: {
          receiveEmail:true,
        },
      },
    },
  });
  res.send(users);
}));

app.get('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    include:{
      userPreference: true,
      savedProducts: true,
    },
  });
  res.send(user);
}));

app.post('/users', asyncHandler(async (req, res) => {
  assert(req.body, CreateUser);
  const {userPreference, ...userFields } = req.body;
  const user = await prisma.user.create({
    data: {
      ...userFields,
      userPreference:{
        create: userPreference,
      },
    },
    include:{
      userPreference:true,
    },
  });
  res.status(201).send(user);
}));

app.patch('/users/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchUser);
  const { id } = req.params;
  const {userPreference, ...userFields } = req.body;
  const user = await prisma.user.update({
    where: {id},
    data: {
      ...userFields,
      userPreference:{
        update: userPreference,
      },
    },
    include:{
      userPreference:true,
    },
  });
  res.send(user);
}));

app.delete('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({
    where: { id },
  });
  res.sendStatus(204);
}));

//특정유저가 즐찾한 제품들 보이기
app.get('/users/:id/saved-products', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {savedProducts} = await prisma.user.findUniqueOrThrow({
    where: { id },
    include:{
      savedProducts: true,
    },
  });
  res.send(savedProducts);
}));
//특정유저가 주문한 모든것 조회
app.get('/users/:id/orders', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    include:{
      Orders:true,
    },
    
  });
  res.send(user.Orders);
}));
//유저가 제품 즐겨찾기 추가및삭제
app.post('/users/:id/saved-products', asyncHandler(async (req, res) => {
  assert(req.body, PostSavedProduct);
  const { id: userId } = req.params;
  const { productId } = req.body;

  // 먼저 현재 연결 상태를 확인합니다.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { savedProducts: true },
  });

  // 제품이 현재 저장된 제품 목록에 있는지 확인합니다.
  const isProductSaved = user.savedProducts.some(product => product.id === productId);

  let updatedUser;
  if (isProductSaved) {
    // 제품이 연결되어 있으면 해제합니다.
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        savedProducts: {
          disconnect: { id: productId },
        },
      },
      include: { savedProducts: true },
    });
  } else {
    // 제품이 연결되어 있지 않으면 연결합니다.
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        savedProducts: {
          connect: { id: productId },
        },
      },
      include: { savedProducts: true },
    });
  }

  res.send(updatedUser.savedProducts);
}));
/**
 * 추가 기능만구현
  app.post('/users/:id/saved-products', asyncHandler(async (req, res) => {
  assert(req.body, PostSavedProduct);
  const { id: userId } = req.params;
  const { productId } = req.body;
  const { savedProducts } = await prisma.user.update({
    where: { id: userId },
    data:{
      savedProducts:{
        connect: {
          id: productId,//유저를 이productId가진 상품과 연결하라는 뜻
        },
      },
    },
    include:{
      savedProducts: true,
    },
  });
  res.send(savedProducts);
}));
 */
/*********** products ***********/

app.get('/products', asyncHandler(async (req, res) => {
  const { offset = 0, limit = 10, order = 'newest', category } = req.query;
  let orderBy;
  switch (order) {
    case 'priceLowest':
      orderBy = { price: 'asc' };
      break;
    case 'priceHighest':
      orderBy = { price: 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
  }
  const where = category ? { category } : {};
  const products = await prisma.product.findMany({
    where,
    orderBy,
    skip: parseInt(offset),
    take: parseInt(limit),
  });
  res.send(products);
}));

app.get('/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await prisma.product.findUnique({
    where: { id },
  });
  res.send(product);
}));

app.post('/products', asyncHandler(async (req, res) => {
  assert(req.body, CreateProduct);
  const product = await prisma.product.create({
    data: req.body,
  });
  res.status(201).send(product);
}));

app.patch('/products/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchProduct);
  const { id } = req.params;
  const product = await prisma.product.update({
    where: { id },
    data: req.body,
  });
  res.send(product);
}));

app.delete('/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.product.delete({
    where: { id },
  });
  res.sendStatus(204);
}));

/*********** orders ***********/

app.get('/orders', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany();
  res.send(orders);
}));

app.get('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include:{
      orderItems: true,
    },
  });
  let total = 0;
  order.orderItems.forEach((orderItem)=>{
    total += orderItem.unitPrice * orderItem.quantity;
  });
  order.total = total;
  res.send(order);
}));

app.post('/orders', asyncHandler(async (req, res) => {
  assert(req.body, CreateOrder);
  const {orderItems, ...userId} = req.body;

  //제품 id가져오기
  const productIds = orderItems.map((orderItem) => orderItem.productId);
  //제품 id로 제품 정보 가져오기
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
  });
  //제품 남은 개수 함수
  function getQuantity(productId){
    const orderItem = orderItems.find(
      (orderItem)=> orderItem.productId === productId
    );
    return orderItem.quantity;
  }
  //남은 재고 확인하고 요청개수와 비교
  const isSufficientStock = products.every((proudct)=>{
    const {id, stock } = proudct;
    return stock >= getQuantity(id);
  })
  if(!isSufficientStock){
    throw new Error('Insufficient Stock');
  }
  /* transaction사용으로 필요 없어짐
  const order = await prisma.order.create({
    data:{
      ...userId,
      orderItems:{
        create: orderItems,
      },
    },
    include: {
      orderItems: true,
    },
  });
  */
  //해당 제고들 getQuantity(productId)개수만큼 감소(decrement사용)
  //Promise.all사용해 효율적인 코드 작성
  const queries = productIds.map((productId) =>
    prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: getQuantity(productId) } },
    })
  );
  //await Promise.all(queries); transaction사용으로 필요 없어짐

  //여러가지 수행을 한번에 수행하여 무결성보장 하는법(transaction)
  const [order] = await prisma.$transaction([
    prisma.order.create({
      data:{
        ...userId,
        orderItems:{
          create: orderItems,
        },
      },
      include: {
        orderItems: true,
      },
    }),
    ...queries,
  ]);
  res.status(201).send(order);
}));

app.patch('/orders/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchOrder);
  const { id } = req.params;
  const order = await prisma.order.update({
    where: { id },
    data: req.body,
  });
  res.send(order);
}));

app.delete('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.order.delete({ where: { id } });
  res.sendStatus(204);
}));

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));
