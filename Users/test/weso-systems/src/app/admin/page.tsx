'use client';

import {Button} from '@/components/ui/button';
import Link from 'next/link';
import {PlusCircle} from 'lucide-react';
import {hotelColumns} from '@/components/data-table/columns';
import {DataTable} from '@/components/data-table/data-table';
import {db} from '@/lib/firebase/client';
import {collection, onSnapshot, orderBy, query, Timestamp} from 'firebase/firestore';
import {Hotel} from '@/lib/types';
import {useEffect, useState, Suspense} from 'react';
import { useSearchParams } from 'next/navigation';

function AgencyDashboard() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  
  // This effect handles the temporary storage and retrieval of the new hotelier password.
  useEffect(() => {
    // This is a client-side only operation.
    if (typeof window === 'undefined') return;

    const tempPassword = sessionStorage.getItem('tempNewPassword');
    
    const hotelsCollection = collection(db, 'hotels');
    const q = query(hotelsCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {

        const hotelsList = snapshot.docs.map((doc) => {
          const data = doc.data();

          // Handle Timestamp conversion safely
          const createdAt = data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString() 
            : new Date().toISOString();
          
          let hotelier = data.hotelier;
          // Attach the temporarily stored password to the most recently created hotel
          // This allows the "copy credentials" button to work once.
          if (tempPassword && snapshot.docs[0].id === doc.id) {
             hotelier = { ...hotelier, password: tempPassword };
          }
          
          return {
            id: doc.id,
            ...data,
            hotelier: hotelier,
            createdAt: createdAt,
          } as Hotel;
        });
        
        setHotels(hotelsList);
        setLoading(false);
        
        // The temporary password has been attached, now we can clear it from storage.
        if (tempPassword) {
            sessionStorage.removeItem('tempNewPassword');
        }

      },
      (error) => {
        console.error('Error fetching hotels:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">Hotelübersicht</h1>
          <p className="mt-1 text-muted-foreground">
            Verwalten Sie alle Ihre Hotelpartner an einem Ort.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/create-hotel">
            <PlusCircle className="mr-2 h-4 w-4" />
            Neues Hotel anlegen
          </Link>
        </Button>
      </div>
      <DataTable
        columns={hotelColumns}
        data={hotels}
        filterColumnId="hotelName"
        filterPlaceholder="Hotels filtern..."
        loading={loading}
      />
    </div>
  );
}

export default function AgencyDashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AgencyDashboard />
    </Suspense>
  )
}
