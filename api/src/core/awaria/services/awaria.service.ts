import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Awaria, Stanowisko, Pracownik } from 'src/core/database/entities';
import { CreateAwariaDto } from '../dtos/create-awaria.dto';
import { Gateway } from '../../../gateway/gateway';
import { Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AwariaService {
  constructor(
    private gateway: Gateway,
    @InjectRepository(Awaria) private awariaRepository: Repository<Awaria>,
    @InjectRepository(Stanowisko)
    private stanowiskoRepository: Repository<Stanowisko>,
    @InjectRepository(Pracownik)
    private pracownikRepository: Repository<Pracownik>,
  ) {}
  async awariaList() {
    const awarie = await this.awariaRepository.find({
      where: { status: Not(3) },
      relations: {
        stanowisko: true,
        pracownik: true,
      },
      select: {
        pracownik: {
          id: true,
          imie: true,
          nazwisko: true,
        },
        stanowisko: {
          id: true,
          kod: true,
          opis: true,
          nazwa: true,
        },
      },
    });

    return awarie;
  }

  async finishedAwariaList() {
    const awarie = await this.awariaRepository.find({
      where: { status: 3 },
      relations: {
        stanowisko: true,
        pracownik: true,
      },
      select: {
        pracownik: {
          id: true,
          imie: true,
          nazwisko: true,
        },
        stanowisko: {
          id: true,
          kod: true,
          opis: true,
          nazwa: true,
        },
      },
    });

    return awarie;
  }

  async awariaListByStanowisko(id) {
    const stanowisko = await this.stanowiskoRepository.findOne({
      where: { id: id },
    });
    if (!stanowisko)
      throw new HttpException(
        'Nie znaleziono stanowiska o podanym ID',
        HttpStatus.NOT_FOUND,
      );
    const awarie = await this.awariaRepository.find({
      where: { status: Not(3), stanowisko: stanowisko },
      relations: {
        stanowisko: true,
        pracownik: true,
      },
      select: {
        pracownik: {
          id: true,
          imie: true,
          nazwisko: true,
        },
        stanowisko: {
          id: true,
          kod: true,
          opis: true,
          nazwa: true,
        },
      },
    });

    return awarie;
  }

  async awariaById(id) {
    const awaria = await this.awariaRepository.findOne({
      where: { id: id },
      relations: {
        stanowisko: true,
        pracownik: true,
      },
      select: {
        pracownik: {
          id: true,
          imie: true,
          nazwisko: true,
        },
        stanowisko: {
          id: true,
          kod: true,
          opis: true,
          nazwa: true,
        },
      },
    });
    if (awaria) return awaria;
    throw new HttpException(
      'Nie znaleziono awarii o podanym ID',
      HttpStatus.NOT_FOUND,
    );
  }

  async createAwaria(createAwariaDto: CreateAwariaDto) {
    if (createAwariaDto.opis_awarii.length > 500) {
      throw new HttpException(
        'Opis awarii jest zbyt długi',
        HttpStatus.NOT_ACCEPTABLE,
      );
    }
    const newAwaria = new Awaria();
    const stanowisko = await this.stanowiskoRepository.findOne({
      where: { id: createAwariaDto.stanowisko },
      select: {
        id: true,
        kod: true,
        opis: true,
        nazwa: true,
      },
    });

    if (!stanowisko)
      throw new HttpException(
        'Nie znaleziono stanowiska o podanym ID',
        HttpStatus.NOT_FOUND,
      );

    newAwaria.mozna_pracowac = createAwariaDto.mozna_pracowac;
    newAwaria.opis_awarii = createAwariaDto.opis_awarii;
    newAwaria.priorytet = createAwariaDto.priorytet;
    newAwaria.stanowisko = stanowisko;
    newAwaria.status = 1;

    await this.awariaRepository.save(newAwaria);

    this.gateway.server.emit('newAwaria', { newAwaria });

    return 'Success';
  }

  async claimAwaria(id, req) {
    const pracownik = await this.pracownikRepository.findOneBy({
      id: req.user.id,
    });
    const to_update = await this.awariaRepository.findOneBy({ id: id });
    if (!pracownik) {
      throw new HttpException(
        'Nie znaleziono pracownika o podanym ID',
        HttpStatus.NOT_FOUND,
      );
    }
    if (to_update.status != 1) {
      throw new HttpException(
        'Ta awaria została już podjęta',
        HttpStatus.CONFLICT,
      );
    }
    let time = new Date(Date.now());
    time.setTime(time.getTime() + 2 * 60 * 60 * 1000);
    const date = time.toISOString();
    try {
      await this.awariaRepository.update(id, {
        status: 2,
        pracownik: pracownik,
        data_podjecia: date,
      });
      const updated = await this.awariaRepository.findOne({
        where: { id: id },
        relations: {
          stanowisko: true,
          pracownik: true,
        },
        select: {
          pracownik: {
            id: true,
            imie: true,
            nazwisko: true,
          },
          stanowisko: {
            id: true,
            kod: true,
            opis: true,
            nazwa: true,
          },
        },
      });
      this.gateway.server.emit('claimedAwaria', { updated });
    } catch (e) {
      throw new HttpException(
        `Nie znaleziono awarii o podanym id równym < ${id} >`,
        HttpStatus.NO_CONTENT,
      );
    }

    return 'Success';
  }

  async assignAwaria(idAwarii, idPracownika) {
    // console.log(this.gateway.server.)
    const pracownik = await this.pracownikRepository.findOneBy({
      id: idPracownika,
    });
    const to_update = await this.awariaRepository.findOneBy({ id: idAwarii });
    if (!pracownik) {
      throw new HttpException(
        'Nie znaleziono pracownika o podanym ID',
        HttpStatus.NOT_FOUND,
      );
    }
    if (to_update.status != 1) {
      throw new HttpException(
        'Ta awaria została już podjęta',
        HttpStatus.CONFLICT,
      );
    }

    let time = new Date(Date.now());
    time.setTime(time.getTime() + 2 * 60 * 60 * 1000);
    const date = time.toISOString();
    try {
      await this.awariaRepository.update(idAwarii, {
        status: 2,
        pracownik: pracownik,
        data_podjecia: date,
      });
      const updated = await this.awariaRepository.findOne({
        where: { id: idAwarii },
        relations: {
          stanowisko: true,
          pracownik: true,
        },
        select: {
          pracownik: {
            id: true,
            imie: true,
            nazwisko: true,
          },
          stanowisko: {
            id: true,
            kod: true,
            opis: true,
            nazwa: true,
          },
        },
      });
      // poprawić na koniec
      this.gateway.server
        .to('6')
        .to(idPracownika)
        .emit('assignedAwaria', { updated });
    } catch (e) {
      throw new HttpException(
        `Nie znaleziono awarii o podanym id równym < ${idAwarii} >`,
        HttpStatus.NO_CONTENT,
      );
    }

    return 'Success';
  }

  async finishAwaria(id, req) {
    const pracownik = await this.pracownikRepository.findOneBy({
      id: req.user.id,
    });
    const to_update = await this.awariaRepository.findOne({
      where: { id: id },
      relations: {
        pracownik: true,
      },
      select: {
        pracownik: {
          id: true,
          imie: true,
          nazwisko: true,
        },
      },
    });
    if (!pracownik) {
      throw new HttpException(
        'Nie znaleziono pracownika o podanym ID',
        HttpStatus.NOT_FOUND,
      );
    }
    if (to_update.status != 2) {
      throw new HttpException(
        'Nie możesz ukończyć tej awarii',
        HttpStatus.CONFLICT,
      );
    }
    if (to_update.pracownik.id != req.user.id) {
      throw new HttpException(
        'Nie możesz ukończyć nie swojej awarii',
        HttpStatus.CONFLICT,
      );
    }
    let time = new Date(Date.now());
    time.setTime(time.getTime() + 2 * 60 * 60 * 1000);
    const date = time.toISOString();
    try {
      await this.awariaRepository.update(id, { status: 3, data_naprawy: date });
      const updated = await this.awariaRepository.findOne({
        where: { id: id },
        relations: {
          stanowisko: true,
          pracownik: true,
        },
        select: {
          pracownik: {
            id: true,
            imie: true,
            nazwisko: true,
          },
          stanowisko: {
            id: true,
            kod: true,
            opis: true,
            nazwa: true,
          },
        },
      });
      this.gateway.server.emit('finishedAwaria', { updated });
    } catch (e) {
      throw new HttpException(
        `Nie znaleziono awarii o podanym id równym < ${id} >`,
        HttpStatus.NO_CONTENT,
      );
    }

    return 'Success';
  }

  async awariaListByPracownik(id) {
    const pracownik = await this.pracownikRepository.findOne({
      where: { id: id },
    });
    if (!pracownik)
      throw new HttpException(
        'Nie znaleziono pracownika o podanym ID',
        HttpStatus.NOT_FOUND,
      );
    const awarie = await this.awariaRepository.find({
      where: { status: Not(3), pracownik: pracownik },
      relations: {
        stanowisko: true,
      },
      select: {
        stanowisko: {
          id: true,
          kod: true,
          opis: true,
          nazwa: true,
        },
      },
    });
    awarie.sort((a, b) => (a.data_podjecia > b.data_podjecia ? 1 : -1));
    return awarie;
  }
}
