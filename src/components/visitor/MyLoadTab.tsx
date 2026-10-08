import React from 'react';
import { Visitor, Order } from '../../types';
import { VisitorInvoiceSection } from './VisitorInvoiceSection';

interface MyLoadTabProps {
  currentVisitor: Visitor;
  orders: Order[];
}

export const MyLoadTab: React.FC<MyLoadTabProps> = ({
  currentVisitor,
  orders,
}) => {
  return (
    <div className="space-y-4 pb-24 sm:pb-8">
      <VisitorInvoiceSection
        currentVisitor={currentVisitor}
        orders={orders}
      />
    </div>
  );
};
