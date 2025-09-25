'use server';

import {db, auth} from '@/lib/firebase/admin';
import {Timestamp, FieldValue} from 'firebase-admin/firestore';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {Booking, Room, IdUploadRequirement, BookingStatus} from '@/lib/types';
import {DateRange} from 'react-day-picker';

type CreateHotelState = {
  message: string;
  success: boolean;
  errorType?: 'email' | null;
};

export async function createHotelAction(
  prevState: CreateHotelState,
  formData: FormData
): Promise<CreateHotelState> {
  const hotelierEmail = formData.get('hotelierEmail') as string;
  const hotelierPassword = formData.get('hotelierPassword') as string;

  if (!hotelierEmail || !hotelierPassword || hotelierPassword.length < 6) {
    return {
        message: 'E-Mail und ein Passwort mit mindestens 6 Zeichen sind erforderlich.',
        success: false
    };
  }


  let userRecord;
  try {
      userRecord = await auth.createUser({
          email: hotelierEmail,
          password: hotelierPassword,
          emailVerified: true,
          disabled: false,
      });
  } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
          return {
              message: 'Diese E-Mail-Adresse wird bereits für ein anderes Hotel verwendet.',
              success: false,
              errorType: 'email',
          };
      }
      console.error('Error creating Firebase Auth user:', error);
      return {
          message: 'Fehler beim Erstellen des Authentifizierungsbenutzers.',
          success: false
      };
  }
  

  const mealTypes = formData.getAll('mealTypes') as string[];
  const roomCategories = formData.getAll('roomCategories') as string[];
  const canEditBankDetails = formData.get('canEditBankDetails') === 'on';

  const hotelData = {
    hotelName: formData.get('hotelName') as string,
    domain: formData.get('domain') as string,
    logoUrl: formData.get('logoUrl') as string,
    createdAt: FieldValue.serverTimestamp(),

    // Das Passwort wird NICHT mehr in Firestore gespeichert.
    // Die UID des Auth-Users wird als Referenz gespeichert.
    hotelier: {
      email: hotelierEmail,
      uid: userRecord.uid,
    },

    contact: {
      email: formData.get('contactEmail') as string,
      phone: formData.get('contactPhone') as string,
    },

    bankDetails: {
      accountHolder: formData.get('accountHolder') as string,
      iban: formData.get('iban') as string,
      bic: formData.get('bic') as string,
      bankName: formData.get('bankName') as string,
    },

    smtp: {
      host: formData.get('smtpHost') as string,
      port: Number(formData.get('smtpPort')),
      user: formData.get('smtpUser') as string,
      appPass: formData.get('smtpPass') as string,
    },

    bookingConfig: {
      mealTypes: mealTypes,
      roomCategories: roomCategories,
    },
    permissions: {
      canEditBankDetails: canEditBankDetails,
    }
  };

  try {
    const docRef = await db.collection('hotels').add(hotelData);
    
    // WICHTIG: Dem Auth-Benutzer die Hotel-ID als Custom Claim zuweisen
    await auth.setCustomUserClaims(userRecord.uid, { role: 'hotelier', hotelId: docRef.id });

    console.log('Hotel created with ID: ', docRef.id);
  } catch (error) {
    console.error('Error creating hotel or setting claims:', error);
    // Wenn hier etwas schiefgeht, sollten wir den Auth-Benutzer wieder löschen,
    // um "verwaiste" Benutzer zu vermeiden.
    await auth.deleteUser(userRecord.uid);
    return {
      message: 'Hotel konnte nicht erstellt werden.',
      success: false,
    };
  }

  revalidatePath('/admin');
  return { success: true, message: 'Hotel erfolgreich erstellt!' };
}

export async function deleteHotelAction(hotelId: string) {
  try {
    const hotelDoc = await db.collection('hotels').doc(hotelId).get();
    const hotelData = hotelDoc.data();

    // Zuerst den Firebase Auth Benutzer löschen, falls vorhanden
    if (hotelData?.hotelier?.uid) {
        try {
            await auth.deleteUser(hotelData.hotelier.uid);
        } catch (authError: any) {
            // Wenn der Benutzer nicht gefunden wird, ist das okay, vielleicht wurde er manuell gelöscht.
            if (authError.code !== 'auth/user-not-found') {
                throw authError; // Andere Auth-Fehler weiterwerfen
            }
        }
    }

    // Dann das Hotel-Dokument aus Firestore löschen
    await db.collection('hotels').doc(hotelId).delete();

    revalidatePath('/admin');
    return {
      message: 'Hotel und zugehöriger Benutzer erfolgreich gelöscht.',
      success: true,
    };
  } catch (error) {
    console.error('Error deleting hotel:', error);
    return {
      message: 'Fehler beim Löschen des Hotels.',
      success: false,
    };
  }
}

export async function createBookingAction(
  hotelId: string,
  formData: FormData,
  rooms: Room[],
  date?: DateRange
) {
  if (!date?.from || !date?.to) {
    return {success: false, message: 'An- und Abreisedatum sind erforderlich.'};
  }

  const priceString = formData.get('price') as string;
  const price = parseFloat(priceString);

  if (isNaN(price) || price < 0) {
      return { success: false, message: 'Ungültiger Preis. Bitte geben Sie eine gültige Zahl ein.' };
  }

  const bookingData: Omit<Booking, 'id' | 'hotelId'> = {
    guestName: `${formData.get('firstName')} ${formData.get('lastName')}`,
    checkIn: Timestamp.fromDate(date.from),
    checkOut: Timestamp.fromDate(date.to),
    price: price,
    mealType: formData.get('mealType') as string,
    language: formData.get('language') as 'de' | 'en' | 'it' || 'de',
    idUploadRequirement: formData.get('idUploadRequirement') as IdUploadRequirement || 'choice',
    internalNotes: (formData.get('internalNotes') as string) || '',
    rooms: rooms,
    status: 'Pending',
    createdAt: Timestamp.now(),
  };

  try {
    const bookingCollection = db.collection('hotels').doc(hotelId).collection('bookings');
    const docRef = await bookingCollection.add(bookingData);

    // This is the crucial part: create the full booking object to store in the link
    const fullBookingData: Booking = {
        ...bookingData,
        id: docRef.id, // The ID of the booking document itself
        hotelId: hotelId,
    }

    // Now, create the booking link document with ALL the necessary data
    const linkRef = await db.collection('bookingLinks').add({
      hotelId: hotelId,
      bookingId: docRef.id,
      createdAt: Timestamp.now(),
      status: 'active', // 'active' means the link can be used
      booking: fullBookingData // Embed the full booking data
    });

    revalidatePath(`/dashboard/${hotelId}/bookings`);

    // Use NEXT_PUBLIC_APP_URL for the domain to ensure it works in all environments
    const domain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const bookingLink = `${domain}/guest/${linkRef.id}`;

    return {success: true, link: bookingLink};
  } catch (error) {
    console.error('Error creating booking:', error);
    return {success: false, message: 'Buchung konnte nicht erstellt werden.'};
  }
}

export async function updateBookingAction(
  hotelId: string,
  bookingId: string,
  formData: FormData,
  rooms: Room[],
  date?: DateRange
) {
  if (!date?.from || !date?.to) {
    return {success: false, message: 'An- und Abreisedatum sind erforderlich.'};
  }

  const priceString = formData.get('price') as string;
  const price = parseFloat(priceString);

  if (isNaN(price) || price < 0) {
      return { success: false, message: 'Ungültiger Preis. Bitte geben Sie eine gültige Zahl ein.' };
  }
  
  const bookingRef = db.collection('hotels').doc(hotelId).collection('bookings').doc(bookingId);

  const updatedBookingData = {
    guestName: `${formData.get('firstName')} ${formData.get('lastName')}`,
    checkIn: Timestamp.fromDate(date.from),
    checkOut: Timestamp.fromDate(date.to),
    price: price,
    mealType: formData.get('mealType') as string,
    language: formData.get('language') as 'de' | 'en' | 'it' || 'de',
    idUploadRequirement: formData.get('idUploadRequirement') as IdUploadRequirement || 'choice',
    internalNotes: (formData.get('internalNotes') as string) || '',
    rooms: rooms,
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    await bookingRef.update(updatedBookingData);
    
    // Also update the booking data in the corresponding link document if it exists
    const linksCollection = db.collection('bookingLinks');
    const linkQuery = linksCollection.where('bookingId', '==', bookingId).where('hotelId', '==', hotelId);
    const linkSnapshot = await linkQuery.get();

    if (!linkSnapshot.empty) {
      const linkDocRef = linkSnapshot.docs[0].ref;
      await linkDocRef.update({
        'booking.guestName': updatedBookingData.guestName,
        'booking.checkIn': updatedBookingData.checkIn,
        'booking.checkOut': updatedBookingData.checkOut,
        'booking.price': updatedBookingData.price,
        'booking.mealType': updatedBookingData.mealType,
        'booking.language': updatedBookingData.language,
        'booking.idUploadRequirement': updatedBookingData.idUploadRequirement,
        'booking.internalNotes': updatedBookingData.internalNotes,
        'booking.rooms': updatedBookingData.rooms,
      });
    }

    revalidatePath(`/dashboard/${hotelId}/bookings`);
    revalidatePath(`/dashboard/${hotelId}/bookings/${bookingId}`);

    return { success: true };
  } catch (error) {
    console.error('Error updating booking:', error);
    return { success: false, message: 'Buchung konnte nicht aktualisiert werden.' };
  }
}


type UpdateProfileState = {
  message: string;
  success: boolean;
};

export async function updateHotelierProfileAction(
  hotelId: string,
  prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const email = formData.get('email') as string;
  const newPassword = formData.get('new-password') as string;
  const confirmPassword = formData.get('confirm-password') as string;

  if (!email) {
    return { message: 'E-Mail ist erforderlich.', success: false };
  }

  const hotelRef = db.collection('hotels').doc(hotelId);

  try {
    const hotelSnap = await hotelRef.get();
    if (!hotelSnap.exists) throw new Error("Hotel not found");
    const hotelData = hotelSnap.data();
    if (!hotelData?.hotelier?.uid) throw new Error("Hotelier UID not found");
    
    const uid = hotelData.hotelier.uid;

    const updates: any = { 'hotelier.email': email };
    const authUpdates: any = { email: email };

    if (newPassword) {
      if (newPassword.length < 6) {
        return { message: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.', success: false };
      }
      if (newPassword !== confirmPassword) {
        return { message: 'Die Passwörter stimmen nicht überein.', success: false };
      }
      authUpdates.password = newPassword;
    }
    
    await auth.updateUser(uid, authUpdates);
    await hotelRef.update(updates);
    
    revalidatePath(`/dashboard/${hotelId}/profile`);
    return { message: 'Profil erfolgreich aktualisiert!', success: true };

  } catch (error) {
    console.error('Error updating profile:', error);
    return { message: 'Ein Fehler ist aufgetreten. Das Profil konnte nicht aktualisiert werden.', success: false };
  }
}


export async function updateHotelLogo(hotelId: string, logoUrl: string) {
  try {
    const hotelRef = db.collection('hotels').doc(hotelId);
    await hotelRef.update({
      logoUrl: logoUrl,
    });
    revalidatePath(`/dashboard/${hotelId}`);
    revalidatePath(`/dashboard/${hotelId}/profile`);
    return { success: true, message: 'Logo updated successfully.' };
  } catch (error) {
    console.error('Error updating hotel logo:', error);
    return { success: false, message: 'Failed to update logo.' };
  }
}

export async function updateBookingStatus(
  hotelId: string,
  bookingId: string,
  status: BookingStatus
) {
  try {
    const bookingRef = db.collection('hotels').doc(hotelId).collection('bookings').doc(bookingId);
    await bookingRef.update({
      status: status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`/dashboard/${hotelId}/bookings`);
    return { success: true, message: 'Status erfolgreich aktualisiert.' };
  } catch (error) {
    console.error('Error updating booking status:', error);
    return { success: false, message: 'Fehler beim Aktualisieren des Status.' };
  }
}

export async function deleteBookingsAction(hotelId: string, bookingIds: string[]) {
  if (!bookingIds || bookingIds.length === 0) {
    return { success: false, message: 'Keine Buchungen zum Löschen ausgewählt.' };
  }

  const batch = db.batch();

  try {
    // Get all booking links associated with the booking IDs to delete them as well
    const linksCollection = db.collection('bookingLinks');
    const linkQuery = linksCollection.where('bookingId', 'in', bookingIds);
    const linkSnapshot = await linkQuery.get();

    linkSnapshot.forEach(linkDoc => {
      batch.delete(linkDoc.ref);
    });

    // Delete the bookings themselves
    bookingIds.forEach(id => {
      const bookingRef = db.collection('hotels').doc(hotelId).collection('bookings').doc(id);
      batch.delete(bookingRef);
    });

    await batch.commit();
    
    revalidatePath(`/dashboard/${hotelId}/bookings`);
    return { success: true, message: 'Ausgewählte Buchungen erfolgreich gelöscht.' };

  } catch (error) {
    console.error('Error deleting bookings:', error);
    return { success: false, message: 'Fehler beim Löschen der Buchungen.' };
  }
}

type UpdateSettingsState = {
  message: string;
  success: boolean;
};

export async function updateHotelSettingsAction(
  hotelId: string,
  prevState: UpdateSettingsState,
  formData: FormData
): Promise<UpdateSettingsState> {

  const hotelRef = db.collection('hotels').doc(hotelId);

  try {
    const hotelSnap = await hotelRef.get();
    if (!hotelSnap.exists()) {
      return { message: 'Hotel nicht gefunden.', success: false };
    }
    const hotelData = hotelSnap.data();
    const canEditBankDetails = hotelData?.permissions?.canEditBankDetails ?? false;

    // Basisdaten validieren
    const hotelName = formData.get('hotelName') as string;
    const domain = formData.get('domain') as string;
    const contactEmail = formData.get('contactEmail') as string;
    const contactPhone = formData.get('contactPhone') as string;

    if (!hotelName || !domain || !contactEmail || !contactPhone) {
      return { message: 'Alle Basis- und Kontaktdaten sind erforderlich.', success: false };
    }

    const updates: {[key: string]: any} = {
      hotelName,
      domain,
      'contact.email': contactEmail,
      'contact.phone': contactPhone,
    };

    // Bankdaten nur aktualisieren, wenn die Berechtigung vorhanden ist
    if (canEditBankDetails) {
      const accountHolder = formData.get('accountHolder') as string;
      const iban = formData.get('iban') as string;
      const bic = formData.get('bic') as string;
      const bankName = formData.get('bankName') as string;

      if (!accountHolder || !iban || !bic || !bankName) {
         return { message: 'Alle Bankdaten sind erforderlich, wenn sie bearbeitet werden.', success: false };
      }

      updates['bankDetails.accountHolder'] = accountHolder;
      updates['bankDetails.iban'] = iban;
      updates['bankDetails.bic'] = bic;
      updates['bankDetails.bankName'] = bankName;
    }

    await hotelRef.update(updates);

    revalidatePath(`/dashboard/${hotelId}/settings`);
    return { message: 'Einstellungen erfolgreich aktualisiert!', success: true };
  } catch (error) {
    console.error('Error updating hotel settings:', error);
    return { message: 'Die Einstellungen konnten nicht gespeichert werden.', success: false };
  }
}

export async function updateHotelByAgencyAction(
  hotelId: string,
  prevState: UpdateSettingsState,
  formData: FormData
): Promise<UpdateSettingsState> {
  
  const hotelRef = db.collection('hotels').doc(hotelId);

  try {
     const mealTypes = formData.getAll('mealTypes') as string[];
    const roomCategories = formData.getAll('roomCategories') as string[];
    const canEditBankDetails = formData.get('canEditBankDetails') === 'on';

    const smtpPortString = formData.get('smtpPort') as string;
    const smtpPort = parseInt(smtpPortString, 10);
    if (isNaN(smtpPort)) {
      return { success: false, message: 'Ungültiger SMTP Port. Bitte geben Sie eine Zahl ein.' };
    }

    const smtpPass = formData.get('smtpPass') as string;

    const updates: any = {
        hotelName: formData.get('hotelName') as string,
        domain: formData.get('domain') as string,
        logoUrl: formData.get('logoUrl') as string,
        'contact.email': formData.get('contactEmail') as string,
        'contact.phone': formData.get('contactPhone') as string,
        'bankDetails.accountHolder': formData.get('accountHolder') as string,
        'bankDetails.iban': formData.get('iban') as string,
        'bankDetails.bic': formData.get('bic') as string,
        'bankDetails.bankName': formData.get('bankName') as string,
        'smtp.host': formData.get('smtpHost') as string,
        'smtp.port': smtpPort,
        'smtp.user': formData.get('smtpUser') as string,
        'bookingConfig.mealTypes': mealTypes,
        'bookingConfig.roomCategories': roomCategories,
        'permissions.canEditBankDetails': canEditBankDetails,
    };
    
    // Update smtpPass only if a new value is provided
    if (smtpPass) {
        updates['smtp.appPass'] = smtpPass;
    }


    await hotelRef.update(updates);

    revalidatePath('/admin');
    revalidatePath(`/admin/hotel/${hotelId}/edit`);
    
    return { success: true, message: 'Hotel erfolgreich aktualisiert!' };

  } catch (error) {
    console.error('Error updating hotel by agency:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Serverfehler';
    return { success: false, message: `Hotel konnte nicht aktualisiert werden. Fehler: ${errorMessage}` };
  }
}
    
