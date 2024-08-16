import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { db } from "../../config/firestore.config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { authSelector } from "./authSlice";
import { addOrder } from "./ordersSlice";
import {
  notifyDanger,
  notifySuccess,
  notifyWarning,
} from "../../components/Notification";

export const getInitialCartItems = createAsyncThunk(
  "cart/getInitialCart",
  async (arg, thunkApi) => {
    const state = thunkApi.getState();
    const { currentUser } = authSelector(state);

    if (!currentUser || !currentUser.email) {
      return thunkApi.rejectWithValue("Please Login!");
    }

    try {
      const querySnapshot = await getDoc(doc(db, "cart", currentUser.email));
      if (querySnapshot.exists()) {
        const cartItems = { id: querySnapshot.id, ...querySnapshot.data() };
        return cartItems.cartItems;
      }
      return null;
    } catch (error) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

export const addToCart = createAsyncThunk(
  "cart/addToCart",
  async (item, thunkApi) => {
    const state = thunkApi.getState();
    const { currentUser } = authSelector(state);
    const { cart } = cartSelector(state);

    if (!currentUser || !currentUser.email) {
      return thunkApi.rejectWithValue("Please Login!");
    }

    try {
      // fetch cartItems from db
      const docRef = doc(db, "cart", currentUser.email);
      const cartSnapshot = await getDoc(docRef);

      const cartList = cartSnapshot.exists()
        ? [...cartSnapshot.data().cartItems]
        : [];

      // check if item exists
      const isItemExists = cartList.some((cartItem) => cartItem.id === item.id);

      if (isItemExists) {
        // if exists, increment quantity
        cartList.map((cartItem) => {
          if (cartItem.id === item.id) {
            cartItem.quantity++;
          }
          return cartItem;
        });
      } else {
        // if not, add item to cart along with quantity:1
        cartList.push({ ...item, quantity: 1 });
      }

      // push the new cart data to db
      await setDoc(docRef, { cartItems: cartList });

      return [...cart, item];
    } catch (error) {
      console.log(error);
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

export const removeFromCart = createAsyncThunk(
  "cart/removeFromCart",
  async (id, thunkApi) => {
    const state = thunkApi.getState();
    const { currentUser } = authSelector(state);

    if (!currentUser || !currentUser.email) {
      return thunkApi.rejectWithValue("Please Login!");
    }

    try {
      const docRef = doc(db, "cart", currentUser.email);
      const cartSnap = await getDoc(docRef);
      const cartItems = (cartSnap.exists() && cartSnap.data().cartItems) || [];

      const updatedCartItems = cartItems.filter(
        (cartItem) => cartItem.id !== id
      );

      if (updatedCartItems.length === cartItems.length) {
        return thunkApi.rejectWithValue("Item not found");
      }

      // Update the state with the new cart items
      await setDoc(docRef, { cartItems: updatedCartItems });

      // Return updated cart items to update the store
      return updatedCartItems;
    } catch (error) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

export const reduceQuantity = createAsyncThunk(
  "cart/reduceQuantity",
  async (id, thunkApi) => {
    const state = thunkApi.getState();
    const { currentUser } = authSelector(state);

    if (!currentUser || !currentUser.email) {
      return thunkApi.rejectWithValue("Please Login!");
    }

    try {
      const docRef = doc(db, "cart", currentUser.email);
      const cartSnap = await getDoc(docRef);
      const cartItems =
        (cartSnap.exists() && [...cartSnap.data().cartItems]) || [];

      const updatedCartItems = cartItems
        .map((item) => {
          if (item.id === id) {
            return { ...item, quantity: item.quantity - 1 };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);

      // Update the state with the new cart items
      await setDoc(docRef, { cartItems: updatedCartItems });

      // Return updated cart items to update the store
      return updatedCartItems;
    } catch (error) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

export const increaseQuantity = createAsyncThunk(
  "cart/increaseQuantity",
  async (id, thunkApi) => {
    const state = thunkApi.getState();
    const { currentUser } = authSelector(state);

    if (!currentUser || !currentUser.email) {
      return thunkApi.rejectWithValue("Please Login!");
    }

    try {
      const docRef = doc(db, "cart", currentUser.email);
      const cartSnap = await getDoc(docRef);
      const cartItems = (cartSnap.exists() && cartSnap.data().cartItems) || [];

      const updatedCartItems = cartItems.map((item) => {
        if (item.id === id) {
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      });

      // Update the state with the new cart items
      await setDoc(docRef, { cartItems: updatedCartItems });

      // Return updated cart items to update the store
      return updatedCartItems;
    } catch (error) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

export const completePurchase = createAsyncThunk(
  "cart/completePurchase",
  async (arg, thunkApi) => {
    const state = thunkApi.getState();
    const { currentUser } = authSelector(state);
    const { cart, totalPrice } = cartSelector(state);
    console.log("in thunk");
    try {
      await thunkApi
        .dispatch(
          addOrder({
            userId: currentUser.email,
            items: cart,
            total: totalPrice,
            timestamp: new Date().toDateString(),
          })
        )
        .unwrap();

      console.log("Order Confirmed");

      const docRef = doc(db, "cart", currentUser.email);
      await setDoc(docRef, { cartItems: [] });

      console.log("Cart cleared");
      return [];
    } catch (error) {
      console.log("Error in purchase");
      console.log("Error => ", error);
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

const INITIAL_STATE = { cart: [], loading: false, error: null, totalPrice: 0 };

const cartSlice = createSlice({
  name: "cart",
  initialState: INITIAL_STATE,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(getInitialCartItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(getInitialCartItems.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload || [];
        state.totalPrice = state.cart
          .reduce((acc, item) => acc + item.price * item.quantity, 0)
          .toFixed(2);
      })
      .addCase(getInitialCartItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addToCart.pending, (state) => {
        state.loading = true;
        notifyWarning("Adding to cart...");
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload;
        state.totalPrice = state.cart
          .reduce((acc, item) => acc + item.price * item.quantity, 0)
          .toFixed(2);
        notifySuccess("Item added to cart.");
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        notifyDanger("Failed to add to cart!");
      })
      .addCase(removeFromCart.pending, (state) => {
        state.loading = true;
      })
      .addCase(removeFromCart.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload;
        state.totalPrice = state.cart
          .reduce((acc, item) => acc + item.price * item.quantity, 0)
          .toFixed(2);
        notifyDanger("Item removed from the cart!");
      })
      .addCase(removeFromCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(increaseQuantity.pending, (state) => {
        state.loading = true;
        notifyWarning("Increasing the quantity...");
      })
      .addCase(increaseQuantity.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload;
        state.totalPrice = state.cart
          .reduce((acc, item) => acc + item.price * item.quantity, 0)
          .toFixed(2);
        notifySuccess("Quantity increased.");
      })
      .addCase(increaseQuantity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        notifyDanger("Failed to increased increase the quantity!");
      })
      .addCase(reduceQuantity.pending, (state) => {
        state.loading = true;
        notifyWarning("Decreasing the quantity...");
      })
      .addCase(reduceQuantity.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload;
        state.totalPrice = state.cart
          .reduce((acc, item) => acc + item.price * item.quantity, 0)
          .toFixed(2);
        notifySuccess("Quantity Decreased.");
      })
      .addCase(reduceQuantity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        notifyDanger("Failed to decreased increase the quantity!");
      })
      .addCase(completePurchase.pending, (state) => {
        state.loading = true;
        notifyWarning("Placing the order...");
      })
      .addCase(completePurchase.fulfilled, (state, action) => {
        state.loading = false;
        state.cart = action.payload;
        notifySuccess("Order Confirmed!");
      })
      .addCase(completePurchase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        notifyDanger("Failed to place order!");
      }),
});

export const cartReducer = cartSlice.reducer;
export const { initialLoad, add, remove, increase, decrease } =
  cartSlice.actions;
export const cartSelector = (state) => ({
  cart: state.cartReducer.cart,
  totalPrice: state.cartReducer.totalPrice,
  loading: state.cartReducer.loading,
  error: state.cartReducer.error,
});
