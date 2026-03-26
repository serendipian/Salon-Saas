
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';

export const useProducts = () => {
  const { 
    products, 
    productCategories, 
    addProduct, 
    updateProduct, 
    updateProductCategories 
  } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  return {
    products: filteredProducts,
    productCategories,
    searchTerm,
    setSearchTerm,
    addProduct,
    updateProduct,
    updateProductCategories
  };
};
