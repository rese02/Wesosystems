'use client';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, PlusCircle, Trash2, Loader2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Booking, Room } from '@/lib/types';
import { createBookingAction, updateBookingAction } from '@/actions/hotel-actions';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { IdUploadRequirement } from '@/lib/types';

type RoomState = Room & { id: number };

type CreateBookingClientPageProps = {
    hotelId: string;
    booking?: Booking | null;
    config: {
        roomCategories: string[];
        mealTypes: string[];
    }
}

export function CreateBookingClientPage({ hotelId, booking, config }: CreateBookingClientPageProps) {
  const router = useRouter();
  const isEditMode = !!booking;
  
  const [date, setDate] = useState<DateRange | undefined>();
  const [rooms, setRooms] = useState<RoomState[]>(
    booking?.rooms.map((r, i) => ({ ...r, id: i })) ||
    [{ id: Date.now(), type: config.roomCategories[0] || 'Standard', adults: 2, children: 0, infants: 0 }]
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // This effect runs only on the client, ensuring `new Date()` is safe
    if (booking?.checkIn && booking?.checkOut) {
      setDate({
        from: new Date(booking.checkIn as any),
        to: new Date(booking.checkOut as any)
      });
    }
  }, [booking]);


  const addRoom = () => {
    setRooms([
      ...rooms,
      { id: Date.now(), type: config.roomCategories[0] || 'Standard', adults: 1, children: 0, infants: 0 },
    ]);
  };

  const removeRoom = (id: number) => {
    setRooms(rooms.filter((room) => room.id !== id));
  };
  
  const handleSubmit = async (formData: FormData) => {
    if (!date?.from || !date?.to) {
        toast({
            title: 'Fehler',
            description: 'Bitte wählen Sie einen gültigen Zeitraum aus.',
            variant: 'destructive',
        });
        return;
    }
    
    setLoading(true);
    const roomsToSave = rooms.map(({ id, ...rest }) => rest);
    let result;

    if (isEditMode && booking) {
      result = await updateBookingAction(hotelId, booking.id, formData, roomsToSave, date);
    } else {
      result = await createBookingAction(hotelId, formData, roomsToSave, date);
    }
    setLoading(false);

    if (result.success) {
      toast({
        title: isEditMode ? 'Buchung aktualisiert!' : 'Buchungslink erstellt!',
        description: isEditMode 
            ? 'Die Buchungsdaten wurden erfolgreich gespeichert.'
            : 'Der Link wurde in die Zwischenablage kopiert und kann an den Gast gesendet werden.'
      });
      if (!isEditMode && result.link) {
          navigator.clipboard.writeText(result.link);
      }
      router.push(`/dashboard/${hotelId}/bookings`);
    } else {
      toast({
        title: 'Fehler',
        description: result.message,
        variant: 'destructive',
      });
    }
  };
  
  const getInitialName = (part: 'first' | 'last') => {
      if (!booking?.guestName) return '';
      const parts = booking.guestName.split(' ');
      if (part === 'first') {
          return parts[0] || '';
      }
      return parts.slice(1).join(' ');
  }

  return (
    <form action={handleSubmit} className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="font-headline text-3xl font-bold">{isEditMode ? 'Buchung bearbeiten' : 'Neue Buchung erstellen'}</h1>
            <p className="text-muted-foreground">
            {isEditMode ? 'Ändern Sie die Details dieser Buchung.' : 'Bereiten Sie eine Buchung vor und generieren Sie einen Link für den Gast.'}
            </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
            <X className="h-5 w-5"/>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                <CardTitle>Gastdaten</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input id="firstName" name="firstName" required placeholder="Vorname des Hauptgastes" defaultValue={getInitialName('first')}/>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input id="lastName" name="lastName" required placeholder="Nachname des Hauptgastes" defaultValue={getInitialName('last')}/>
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Buchungsdaten</CardTitle>
                <CardDescription>Gesamtpreis und Details für die gesamte Buchung.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label>Zeitraum (Anreise - Abreise)</Label>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={'outline'}
                        className={cn(
                            'w-full justify-start text-left font-normal',
                            !date && 'text-muted-foreground'
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                            <>
                                {format(date.from, 'dd. LLL y', { locale: de })} -{' '}
                                {format(date.to, 'dd. LLL y', { locale: de })}
                            </>
                            ) : (
                            format(date.from, 'dd. LLL y', { locale: de })
                            )
                        ) : (
                            <span>Zeitraum auswählen</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        locale={de}
                        required
                        />
                    </PopoverContent>
                    </Popover>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="price">Gesamtpreis (€)</Label>
                    <Input id="price" name="price" type="number" step="0.01" required placeholder="z.B. 1250.50" defaultValue={booking?.price}/>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="mealType">Verpflegung</Label>
                    <Select name="mealType" required defaultValue={booking?.mealType || config.mealTypes[0]}>
                    <SelectTrigger>
                        <SelectValue placeholder="Verpflegung auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                        {config.mealTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="language">Sprache für Gastformular</Label>
                    <Select name="language" defaultValue={booking?.language || 'de'}>
                    <SelectTrigger>
                        <SelectValue placeholder="Sprache auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="en">Englisch</SelectItem>
                        <SelectItem value="it">Italienisch</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-4 md:col-span-2">
                    <Label>Ausweis-Upload durch Gast</Label>
                    <RadioGroup name="idUploadRequirement" defaultValue={booking?.idUploadRequirement || "choice"} className="flex flex-col sm:flex-row gap-4 pt-2">
                        <Label htmlFor="id-choice" className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border p-4 hover:bg-muted/50 has-[input:checked]:border-primary has-[input:checked]:bg-muted/50">
                            <RadioGroupItem value="choice" id="id-choice" />
                            Gast hat die Wahl (Hochladen oder vor Ort)
                        </Label>
                        <Label htmlFor="id-required" className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border p-4 hover:bg-muted/50 has-[input:checked]:border-primary has-[input:checked]:bg-muted/50">
                            <RadioGroupItem value="required" id="id-required" />
                            Upload ist verpflichtend
                        </Label>
                    </RadioGroup>
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Zimmerdetails</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                {rooms.map((room, index) => (
                    <div key={room.id} className="grid grid-cols-12 gap-2 rounded-md border p-4">
                    <div className="col-span-11 grid gap-4 sm:grid-cols-4">
                        <div className="grid gap-2">
                        <Label>Zimmertyp</Label>
                        <Select 
                            defaultValue={room.type} 
                            onValueChange={(value) => {
                            const newRooms = [...rooms];
                            newRooms[index].type = value;
                            setRooms(newRooms);
                            }}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {config.roomCategories.map((cat, index) => <SelectItem key={`${cat}-${index}`} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        </div>
                        <div className="grid gap-2">
                        <Label>Erwachsene</Label>
                        <Input type="number" min="1" defaultValue={room.adults} onChange={(e) => {
                            const newRooms = [...rooms];
                            newRooms[index].adults = parseInt(e.target.value);
                            setRooms(newRooms);
                            }}/>
                        </div>
                        <div className="grid gap-2">
                        <Label>Kinder (3+)</Label>
                        <Input type="number" min="0" defaultValue={room.children} onChange={(e) => {
                            const newRooms = [...rooms];
                            newRooms[index].children = parseInt(e.target.value);
                            setRooms(newRooms);
                            }}/>
                        </div>
                        <div className="grid gap-2">
                        <Label>Kleinkinder (0-2J)</Label>
                        <Input type="number" min="0" defaultValue={room.infants} onChange={(e) => {
                            const newRooms = [...rooms];
                            newRooms[index].infants = parseInt(e.target.value);
                            setRooms(newRooms);
                            }}/>
                        </div>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                        {rooms.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeRoom(room.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        )}
                    </div>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={addRoom}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Weiteres Zimmer hinzufügen
                </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Interne Bemerkungen (Optional)</CardTitle>
                    <CardDescription>Zusätzliche Informationen für das Hotelpersonal.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea name="internalNotes" placeholder="Interne Notizen hier eingeben..." defaultValue={booking?.internalNotes}/>
                </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
             <Card className="sticky top-20">
                <CardHeader>
                    <CardTitle>Aktionen</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                     <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isEditMode ? 'Änderungen speichern' : 'Buchung erstellen'}
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => router.back()}>Abbrechen</Button>
                </CardContent>
             </Card>
          </div>
      </div>
    </form>
  );
}
