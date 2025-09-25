'use client';
import { useActionState, useState, useEffect, useRef } from 'react';
import { createHotelAction } from '@/actions/hotel-actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Trash2, KeyRound, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FileUpload } from '@/components/guest/file-upload';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const initialState = {
  message: '',
  success: false,
  errorType: null,
};

type RoomCategory = {
  id: number;
  name: string;
};


export default function CreateHotelPage() {
  const router = useRouter();
  const [roomCategories, setRoomCategories] = useState<RoomCategory[]>([
    { id: 1, name: 'Einzelzimmer' },
    { id: 2, name: 'Doppelzimmer' },
  ]);
  const [hotelierPassword, setHotelierPassword] = useState('');
  const passwordRef = useRef('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  
  const wrappedCreateHotelAction = async (prevState: any, formData: FormData) => {
    const result = await createHotelAction(prevState, formData);
    if (result.success) {
      // Temporarily store the password to show it on the next page
      sessionStorage.setItem('tempNewPassword', passwordRef.current);
      router.push(`/admin`);
    }
    return result;
  };

  const [state, action, isPending] = useActionState(wrappedCreateHotelAction, initialState);
  
  useEffect(() => {
    if (state.message && !state.success) {
      toast({
        title: 'Fehler bei der Erstellung',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!?@';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setHotelierPassword(password);
    passwordRef.current = password;
    toast({ title: 'Neues Passwort generiert!' });
  };
  
  const addRoomCategory = () => {
    setRoomCategories([...roomCategories, { id: Date.now(), name: 'Neue Kategorie' }]);
  };
  
  const removeRoomCategory = (id: number) => {
    setRoomCategories(roomCategories.filter((category) => category.id !== id));
  };
  
  const updateRoomCategory = (id: number, name: string) => {
    setRoomCategories(
      roomCategories.map((category) =>
        category.id === id ? { ...category, name } : category
      )
    );
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold">
          Neues Hotel-System anlegen
        </h1>
        <p className="mt-1 text-muted-foreground">
          Setzen Sie ein komplettes, eigenständiges System für einen neuen
          Hotelkunden auf.
        </p>
      </div>

      <form action={action} className="grid gap-8 lg:grid-cols-3">
        <div className="grid gap-8 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Basisinformationen & Branding</CardTitle>
              <CardDescription>
                Allgemeine Informationen und öffentliches Erscheinungsbild des Hotels.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="hotelName">Hotelname</Label>
                  <Input id="hotelName" name="hotelName" placeholder="Name des Hotels" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input id="domain" name="domain" placeholder="Ihre Domain" required />
                </div>
                 <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Kontakt E-Mail</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" placeholder="Ihre Kontakt E-Mail" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactPhone">Kontakt Telefon</Label>
                  <Input id="contactPhone" name="contactPhone" type="tel" placeholder="Ihre Telefonnummer" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Hotel-Logo</Label>
                {logoUrl ? (
                   <div className='relative h-32 w-full rounded-md border p-2'>
                        <Image src={logoUrl} alt="Hotel Logo Vorschau" fill className="object-contain" />
                        <input type="hidden" name="logoUrl" value={logoUrl} />
                   </div>
                ) : (
                    <FileUpload 
                        bookingId="new-hotel-logo" 
                        fileType="logo"
                        uploadedFileUrl={null}
                        onUploadStart={() => setIsUploading(true)}
                        onUploadComplete={(type, url) => { setLogoUrl(url); setIsUploading(false); }}
                        onDelete={() => setLogoUrl('')}
                    />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hotelier-Zugang & Berechtigungen</CardTitle>
              <CardDescription>
                Erstellen Sie den initialen Account und legen Sie die Rechte für den Hotelier fest.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="hotelierEmail">E-Mail des Hoteliers</Label>
                <Input
                  id="hotelierEmail"
                  name="hotelierEmail"
                  type="email"
                  placeholder="Ihre E-Mail für den Hotel-Login"
                  required
                  className={cn({ 'border-destructive': state.errorType === 'email' })}
                />
                 {state.errorType === 'email' && (
                    <p className="flex items-center text-sm text-destructive">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        {state.message}
                    </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hotelierPassword">Passwort</Label>
                <div className="flex gap-2">
                  <Input
                    id="hotelierPassword"
                    name="hotelierPassword"
                    value={hotelierPassword}
                    readOnly
                    placeholder="Sicheres Passwort generieren oder eingeben"
                    required
                  />
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Generieren
                  </Button>
                </div>
              </div>
               <div className="flex items-start space-x-3 rounded-md border p-4">
                  <Checkbox id="canEditBankDetails" name="canEditBankDetails" />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="canEditBankDetails" className="flex items-center gap-2">
                       <ShieldCheck className="h-4 w-4" /> Hotelier darf Bankdaten bearbeiten
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Wenn aktiviert, kann der Hotelier die Bankverbindung in seinen Einstellungen selbst ändern.
                    </p>
                  </div>
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bankverbindung für Überweisungen</CardTitle>
              <CardDescription>
                Diese Daten werden dem Gast für die Überweisung angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="accountHolder">Kontoinhaber</Label>
                <Input
                  id="accountHolder"
                  name="accountHolder"
                  placeholder="Ihr Name des Kontoinhabers"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" name="iban" placeholder="Ihre IBAN" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bic">BIC/SWIFT</Label>
                <Input
                  id="bic"
                  name="bic"
                  placeholder="Ihre BIC/SWIFT"
                  required
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="bankName">Bank</Label>
                <Input
                  id="bankName"
                  name="bankName"
                  placeholder="Ihr Name der Bank"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>E-Mail-Versand (SMTP)</CardTitle>
                <CardDescription>Damit das System im Namen des Hotels E-Mails versenden kann.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="smtpHost">Host</Label>
                    <Input id="smtpHost" name="smtpHost" placeholder="Ihr Host" defaultValue="smtp.gmail.com" required/>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="smtpPort">Port</Label>
                    <Input id="smtpPort" name="smtpPort" type="number" placeholder="Ihr Port" defaultValue="587" required/>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="smtpUser">E-Mail-Benutzer</Label>
                    <Input id="smtpUser" name="smtpUser" placeholder="Ihre E-Mail für den Versand" required/>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="smtpPass">App-Passwort</Label>
                    <Input id="smtpPass" name="smtpPass" placeholder="Ihr zugehöriges App-Passwort" type="password" required/>
                </div>
            </CardContent>
          </Card>

           <Card>
                <CardHeader>
                    <CardTitle>Buchungskonfiguration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                    <Label>Verpflegungsarten</Label>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="fruehstueck" name="mealTypes" value="Frühstück" defaultChecked/>
                            <Label htmlFor="fruehstueck">Frühstück</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="halbpension" name="mealTypes" value="Halbpension"/>
                            <Label htmlFor="halbpension">Halbpension</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="vollpension" name="mealTypes" value="Vollpension"/>
                            <Label htmlFor="vollpension">Vollpension</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Checkbox id="ohne" name="mealTypes" value="Ohne Verpflegung"/>
                            <Label htmlFor="ohne">Ohne Verpflegung</Label>
                        </div>
                    </div>
                    </div>

                    <div className="space-y-2">
                    <Label>Zimmerkategorien</Label>
                    {roomCategories.map((category) => (
                        <div key={category.id} className="flex items-center gap-2">
                        <Input
                            name="roomCategories"
                            defaultValue={category.name}
                            onChange={(e) => updateRoomCategory(category.id, e.target.value)}
                        />
                        {roomCategories.length > 1 && (
                            <Button type="button" variant="outline" size="icon" onClick={() => removeRoomCategory(category.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addRoomCategory}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Zimmerkategorie hinzufügen
                    </Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Aktionen</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isPending || isUploading}
              >
                Hotel erstellen
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
